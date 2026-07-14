resource "aws_cloudwatch_log_group" "api" {
  name              = "/marketplace/${var.environment}/api"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.data.arn
}

resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_lb" "public" {
  name                       = substr("${local.name}-public", 0, 32)
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = true
  idle_timeout               = 30
}

resource "aws_lb_target_group" "api" {
  name        = substr("${local.name}-api", 0, 32)
  port        = 3001
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id

  health_check {
    enabled             = true
    path                = "/health"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
  }

  deregistration_delay = 30
}

resource "aws_lb" "rpc" {
  name                       = substr("${local.name}-rpc", 0, 32)
  internal                   = true
  load_balancer_type         = "network"
  security_groups            = [aws_security_group.rpc_nlb.id]
  subnets                    = aws_subnet.app[*].id
  enable_deletion_protection = true
}

resource "aws_lb_target_group" "rpc" {
  name        = substr("${local.name}-rpc", 0, 32)
  port        = 3002
  protocol    = "TCP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id

  health_check {
    protocol            = "TCP"
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "rpc" {
  load_balancer_arn = aws_lb.rpc.arn
  port              = 3002
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.rpc.arn
  }
}

resource "aws_ecs_task_definition" "api" {
  count = var.launch_enabled ? 1 : 0

  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.api_image_ref
      essential = true
      portMappings = [
        { containerPort = 3001, hostPort = 3001, protocol = "tcp" },
        { containerPort = 3002, hostPort = 3002, protocol = "tcp" },
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "CORS_ORIGINS", value = join(",", var.cors_origins) },
        { name = "MARKETPLACE_PUBLIC_BASE_URL", value = "https://${var.domain_name}" },
        { name = "TORII_MAIN_URL", value = "http://torii-mainnet.marketplace.internal:8080" },
        { name = "TORII_SEPOLIA_URL", value = "http://torii-sepolia.marketplace.internal:8080" },
        { name = "TORII_BUILD_VERSION", value = "fe3ed0ffa1b0ae2f546d13ff390caf404943df02" },
        { name = "TORII_DATABASE_SCHEMA_VERSION", value = "20260714010000" },
        { name = "OTEL_EXPORTER_OTLP_ENDPOINT", value = "http://127.0.0.1:4318" },
      ]
      secrets = [
        { name = "RPC_MAIN_PRIMARY_URL", valueFrom = local.rpc_secret_arns[var.rpc_primary_provider].SN_MAIN },
        { name = "RPC_SEPOLIA_PRIMARY_URL", valueFrom = local.rpc_secret_arns[var.rpc_primary_provider].SN_SEPOLIA },
        { name = "RPC_MAIN_FALLBACK_URL", valueFrom = local.rpc_secret_arns[local.rpc_fallback_provider].SN_MAIN },
        { name = "RPC_SEPOLIA_FALLBACK_URL", valueFrom = local.rpc_secret_arns[local.rpc_fallback_provider].SN_SEPOLIA },
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 20
      }
      readonlyRootFilesystem = true
      linuxParameters = {
        initProcessEnabled = true
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
      dependsOn = [{ containerName = "otel", condition = "START" }]
    },
    {
      name      = "otel"
      image     = var.adot_image_ref
      essential = true
      command   = ["--config=/etc/ecs/ecs-default-config.yaml"]
      portMappings = [
        { containerPort = 4318, hostPort = 4318, protocol = "tcp" },
      ]
      readonlyRootFilesystem = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "otel"
        }
      }
    },
  ])

  depends_on = [terraform_data.release_gate]
}

resource "aws_ecs_service" "api" {
  count = var.launch_enabled ? 1 : 0

  name                               = "marketplace-api"
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.api[0].arn
  desired_count                      = 2
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = false

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.app[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3001
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.rpc.arn
    container_name   = "api"
    container_port   = 3002
  }

  lifecycle { ignore_changes = [desired_count] }

  depends_on = [aws_lb_listener.rpc]
}

resource "aws_appautoscaling_target" "api" {
  count = var.launch_enabled ? 1 : 0

  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  count = var.launch_enabled ? 1 : 0

  name               = "${local.name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api[0].resource_id
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 120
    scale_out_cooldown = 30
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
