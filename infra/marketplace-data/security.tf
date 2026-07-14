data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "CloudFront-only public ALB ingress"
  vpc_id      = aws_vpc.this.id

}

resource "aws_security_group" "api" {
  name        = "${local.name}-api"
  description = "Marketplace API tasks"
  vpc_id      = aws_vpc.this.id

}

resource "aws_security_group" "rpc_nlb" {
  name        = "${local.name}-rpc-nlb"
  description = "Private Torii to API RPC failover proxy"
  vpc_id      = aws_vpc.this.id

}

resource "aws_security_group" "torii" {
  name        = "${local.name}-torii"
  description = "Private single-writer Torii instances"
  vpc_id      = aws_vpc.this.id

}

resource "aws_vpc_security_group_ingress_rule" "alb_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "CloudFront origin traffic"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

resource "aws_vpc_security_group_egress_rule" "alb_api" {
  security_group_id            = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 3001
  to_port                      = 3001
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_security_group_ingress_rule" "api_alb" {
  security_group_id            = aws_security_group.api.id
  description                  = "Public API from ALB"
  ip_protocol                  = "tcp"
  from_port                    = 3001
  to_port                      = 3001
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "api_rpc_nlb" {
  security_group_id            = aws_security_group.api.id
  description                  = "Private RPC proxy from internal NLB"
  ip_protocol                  = "tcp"
  from_port                    = 3002
  to_port                      = 3002
  referenced_security_group_id = aws_security_group.rpc_nlb.id
}

resource "aws_vpc_security_group_egress_rule" "api_torii" {
  security_group_id            = aws_security_group.api.id
  description                  = "Torii private SQL"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.torii.id
}

resource "aws_vpc_security_group_egress_rule" "api_https" {
  security_group_id = aws_security_group.api.id
  description       = "Qualified managed RPC endpoints and AWS APIs"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "api_dns" {
  security_group_id = aws_security_group.api.id
  description       = "VPC DNS"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = "${cidrhost(aws_vpc.this.cidr_block, 2)}/32"
}

resource "aws_vpc_security_group_ingress_rule" "rpc_nlb_torii" {
  security_group_id            = aws_security_group.rpc_nlb.id
  ip_protocol                  = "tcp"
  from_port                    = 3002
  to_port                      = 3002
  referenced_security_group_id = aws_security_group.torii.id
}

resource "aws_vpc_security_group_egress_rule" "rpc_nlb_api" {
  security_group_id            = aws_security_group.rpc_nlb.id
  ip_protocol                  = "tcp"
  from_port                    = 3002
  to_port                      = 3002
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_security_group_ingress_rule" "torii_api" {
  security_group_id            = aws_security_group.torii.id
  description                  = "Server-owned SQL queries from API"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_security_group_egress_rule" "torii_rpc_nlb" {
  security_group_id            = aws_security_group.torii.id
  description                  = "Qualified RPC through the private failover proxy"
  ip_protocol                  = "tcp"
  from_port                    = 3002
  to_port                      = 3002
  referenced_security_group_id = aws_security_group.rpc_nlb.id
}

resource "aws_vpc_security_group_egress_rule" "torii_https" {
  security_group_id = aws_security_group.torii.id
  description       = "HTTPS-only metadata, image, registry, and AWS endpoints"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "torii_http" {
  security_group_id = aws_security_group.torii.id
  description       = "HTTP metadata sources (application SSRF policy still enforced)"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "torii_dns" {
  security_group_id = aws_security_group.torii.id
  description       = "VPC DNS"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = "${cidrhost(aws_vpc.this.cidr_block, 2)}/32"
}

resource "aws_kms_key" "data" {
  description             = "Marketplace indexer data and backup encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "data" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.data.key_id
}
