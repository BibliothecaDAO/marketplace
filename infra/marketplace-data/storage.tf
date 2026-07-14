resource "aws_s3_bucket" "backups" {
  bucket_prefix = "${local.name}-backups-"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "retain-recovery-artifacts"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}

data "aws_iam_policy_document" "backup_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.backups.arn,
      "${aws_s3_bucket.backups.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id
  policy = data.aws_iam_policy_document.backup_bucket.json
}

resource "aws_ebs_volume" "torii" {
  for_each = local.torii_deployments

  availability_zone = data.aws_availability_zones.available.names[each.value.az_index]
  encrypted         = true
  kms_key_id        = aws_kms_key.data.arn
  type              = "gp3"
  size              = each.value.ebs_size
  iops              = each.value.ebs_iops
  throughput        = 125

  tags = {
    Name      = "${local.name}-${each.value.slug}-${each.value.color}-sqlite"
    Snapshot  = "daily"
    Chain     = each.value.chain
    Color     = each.value.color
    Component = "torii"
  }

  lifecycle { prevent_destroy = true }

  depends_on = [terraform_data.release_gate]
}

resource "aws_iam_role" "dlm" {
  name = "${local.name}-dlm"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "dlm.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "daily" {
  description        = "Daily encrypted Torii SQLite snapshots"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]

    resource_locations = ["CLOUD"]

    target_tags = {
      Snapshot = "daily"
    }

    schedule {
      name = "Daily snapshots"
      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["03:00"]
      }
      retain_rule { count = 14 }
      copy_tags = true
    }
  }
}

resource "aws_secretsmanager_secret" "rpc" {
  for_each = toset([
    "quicknode-mainnet",
    "quicknode-sepolia",
    "alchemy-mainnet",
    "alchemy-sepolia",
  ])

  name                    = "${local.name}/rpc/${each.key}"
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 30

  lifecycle { prevent_destroy = true }
}

resource "aws_ecr_repository" "api" {
  name                 = "${local.name}/api"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.data.arn
  }

  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_repository" "torii" {
  name                 = "${local.name}/torii"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.data.arn
  }

  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_lifecycle_policy" "repositories" {
  for_each = {
    api   = aws_ecr_repository.api.name
    torii = aws_ecr_repository.torii.name
  }
  repository = each.value
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retain the last 50 immutable releases"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 50
      }
      action = { type = "expire" }
    }]
  })
}
