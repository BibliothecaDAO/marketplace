data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }
}

resource "aws_cloudwatch_log_group" "torii" {
  for_each = local.chains

  name              = "/marketplace/${var.environment}/torii-${each.value.slug}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.data.arn
}

resource "aws_instance" "torii" {
  for_each = local.torii_deployments

  ami                         = data.aws_ami.al2023.id
  instance_type               = each.value.instance_type
  subnet_id                   = aws_subnet.data[each.value.az_index].id
  vpc_security_group_ids      = [aws_security_group.torii.id]
  iam_instance_profile        = aws_iam_instance_profile.torii.name
  associate_public_ip_address = false
  monitoring                  = true
  ebs_optimized               = true
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  root_block_device {
    encrypted   = true
    kms_key_id  = aws_kms_key.data.arn
    volume_type = "gp3"
    volume_size = 30
  }

  user_data = templatefile("${path.module}/templates/torii-cloud-init.sh.tftpl", {
    aws_region           = var.aws_region
    backup_bucket        = aws_s3_bucket.backups.id
    chain                = each.value.chain
    color                = each.value.color
    restore_color        = each.value.restore_color
    ecr_registry         = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    litestream_image     = coalesce(var.litestream_image_ref, "invalid")
    log_group            = aws_cloudwatch_log_group.torii[each.value.chain].name
    metadata_concurrency = each.value.chain == "SN_MAIN" ? 8 : 4
    rpc_url              = "http://${aws_lb.rpc.dns_name}:3002/${each.value.chain}"
    torii_image          = coalesce(each.value.image_ref, "invalid")
    volume_id            = aws_ebs_volume.torii[each.key].id
  })

  tags = {
    Name      = "${local.name}-${each.value.slug}-${each.value.color}"
    Chain     = each.value.chain
    Color     = each.value.color
    Component = "torii"
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_ebs_volume.torii,
    aws_lb_listener.rpc,
    terraform_data.release_gate,
  ]
}

resource "aws_volume_attachment" "torii" {
  for_each = local.torii_deployments

  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.torii[each.key].id
  instance_id = aws_instance.torii[each.key].id
}

resource "aws_service_discovery_service" "torii_slot" {
  for_each = local.torii_deployments

  name = "torii-${each.value.slug}-${each.value.color}"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.this.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 5
      type = "A"
    }
  }

  health_check_custom_config { failure_threshold = 1 }
}

resource "aws_service_discovery_instance" "torii_slot" {
  for_each = local.torii_deployments

  instance_id = aws_instance.torii[each.key].id
  service_id  = aws_service_discovery_service.torii_slot[each.key].id
  attributes = {
    AWS_INSTANCE_IPV4 = aws_instance.torii[each.key].private_ip
  }
}

resource "aws_service_discovery_service" "torii_active" {
  for_each = local.chains

  name = "torii-${each.value.slug}"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.this.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 5
      type = "A"
    }
  }

  health_check_custom_config { failure_threshold = 1 }
}

resource "aws_service_discovery_instance" "torii_active" {
  for_each = var.launch_enabled ? local.chains : {}

  instance_id = aws_instance.torii["${each.key}-${var.torii_active_color}"].id
  service_id  = aws_service_discovery_service.torii_active[each.key].id
  attributes = {
    AWS_INSTANCE_IPV4 = aws_instance.torii["${each.key}-${var.torii_active_color}"].private_ip
  }
}
