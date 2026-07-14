resource "aws_sns_topic" "alarms" {
  name              = "${local.name}-alarms"
  kms_master_key_id = aws_kms_key.data.id
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${local.name}-api-p95-latency"
  alarm_description   = "Cached API target p95 exceeds 500 ms"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = 0.5
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  metric_query {
    id          = "latency"
    return_data = true
    metric {
      metric_name = "TargetResponseTime"
      namespace   = "AWS/ApplicationELB"
      period      = 60
      stat        = "p95"
      dimensions = {
        LoadBalancer = aws_lb.public.arn_suffix
        TargetGroup  = aws_lb_target_group.api.arn_suffix
      }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.name}-api-5xx"
  alarm_description   = "API target is returning server errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  namespace   = "AWS/ApplicationELB"
  metric_name = "HTTPCode_Target_5XX_Count"
  period      = 60
  statistic   = "Sum"
  dimensions = {
    LoadBalancer = aws_lb.public.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "api_unhealthy" {
  alarm_name          = "${local.name}-api-unhealthy-targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  period              = 60
  statistic           = "Maximum"
  dimensions = {
    LoadBalancer = aws_lb.public.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  count = var.launch_enabled ? 1 : 0

  alarm_name          = "${local.name}-ecs-cpu"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  threshold           = 70
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  period              = 60
  statistic           = "Average"
  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.api[0].name
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  count = var.launch_enabled ? 1 : 0

  alarm_name          = "${local.name}-ecs-memory"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  threshold           = 70
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  period              = 60
  statistic           = "Average"
  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.api[0].name
  }
}

resource "aws_cloudwatch_metric_alarm" "torii_lag" {
  for_each = var.launch_enabled ? local.chains : {}

  alarm_name          = "${local.name}-${each.value.slug}-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  datapoints_to_alarm = 5
  threshold           = 2
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  namespace           = "MarketplaceData"
  metric_name         = "IndexerLagBlocks"
  period              = 60
  statistic           = "Maximum"
  dimensions = {
    Chain = each.key
    Color = var.torii_active_color
  }
}

resource "aws_cloudwatch_metric_alarm" "backup_age" {
  for_each = var.launch_enabled ? local.chains : {}

  alarm_name          = "${local.name}-${each.value.slug}-backup-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 300
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "MarketplaceData"
  metric_name         = "BackupAgeSeconds"
  period              = 60
  statistic           = "Maximum"
  dimensions = {
    Chain = each.key
    Color = var.torii_active_color
  }
}

resource "aws_cloudwatch_metric_alarm" "torii_cpu" {
  for_each = local.torii_deployments

  alarm_name          = "${local.name}-${each.value.slug}-${each.value.color}-cpu"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 15
  threshold           = 70
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  period              = 60
  statistic           = "Average"
  dimensions          = { InstanceId = aws_instance.torii[each.key].id }
}

resource "aws_cloudwatch_metric_alarm" "torii_memory" {
  for_each = local.torii_deployments

  alarm_name          = "${local.name}-${each.value.slug}-${each.value.color}-memory"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 15
  threshold           = 70
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "MarketplaceData"
  metric_name         = "mem_used_percent"
  period              = 60
  statistic           = "Average"
  dimensions          = { InstanceId = aws_instance.torii[each.key].id }
}

resource "aws_cloudwatch_metric_alarm" "torii_disk" {
  for_each = local.torii_deployments

  alarm_name          = "${local.name}-${each.value.slug}-${each.value.color}-disk"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 15
  threshold           = 70
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "MarketplaceData"
  metric_name         = "disk_used_percent"
  period              = 60
  statistic           = "Average"
  dimensions = {
    InstanceId = aws_instance.torii[each.key].id
    path       = "/data"
  }
}

resource "aws_cloudwatch_metric_alarm" "torii_status" {
  for_each = local.torii_deployments

  alarm_name          = "${local.name}-${each.value.slug}-${each.value.color}-status"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  period              = 60
  statistic           = "Maximum"
  dimensions          = { InstanceId = aws_instance.torii[each.key].id }
}

resource "aws_cloudwatch_dashboard" "marketplace" {
  dashboard_name = local.name
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6,
        properties = {
          title = "API latency and errors", region = var.aws_region, view = "timeSeries",
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.public.arn_suffix, { stat = "p95" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { stat = "Sum", yAxis = "right" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6,
        properties = {
          title = "Accepted L2 index lag", region = var.aws_region, view = "timeSeries",
          metrics = [
            for chain, config in local.chains : ["MarketplaceData", "IndexerLagBlocks", "Chain", chain, "Color", var.torii_active_color, { label = config.slug }]
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6,
        properties = {
          title = "Backup age", region = var.aws_region, view = "timeSeries",
          metrics = [
            for chain, config in local.chains : ["MarketplaceData", "BackupAgeSeconds", "Chain", chain, "Color", var.torii_active_color, { label = config.slug }]
          ]
        }
      },
      {
        type = "log", x = 12, y = 6, width = 12, height = 6,
        properties = {
          title = "Recent API errors", region = var.aws_region,
          query = "SOURCE '${aws_cloudwatch_log_group.api.name}' | fields @timestamp, level, requestId, msg | filter level >= 50 | sort @timestamp desc | limit 50"
        }
      },
    ]
  })
}
