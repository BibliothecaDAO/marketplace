output "api_url" {
  value = "https://${var.domain_name}"
}

output "api_ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "torii_ecr_repository_url" {
  value = aws_ecr_repository.torii.repository_url
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.id
}

output "alarm_topic_arn" {
  value = aws_sns_topic.alarms.arn
}

output "github_plan_role_arn" {
  value = aws_iam_role.github_plan.arn
}

output "github_apply_role_arn" {
  value = aws_iam_role.github_apply.arn
}

output "rpc_secret_arns" {
  value     = { for name, secret in aws_secretsmanager_secret.rpc : name => secret.arn }
  sensitive = true
}

output "active_torii_backends" {
  value = {
    for chain, config in local.chains : chain => "torii-${config.slug}.marketplace.internal:8080"
  }
}
