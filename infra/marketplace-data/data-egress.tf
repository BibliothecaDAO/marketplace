locals {
  metadata_private_cidrs = {
    zero            = { rule = 100, cidr = "0.0.0.0/8" }
    rfc1918_10      = { rule = 101, cidr = "10.0.0.0/8" }
    shared          = { rule = 102, cidr = "100.64.0.0/10" }
    loopback        = { rule = 103, cidr = "127.0.0.0/8" }
    rfc1918_172     = { rule = 104, cidr = "172.16.0.0/12" }
    ietf            = { rule = 105, cidr = "192.0.0.0/24" }
    rfc1918_192     = { rule = 106, cidr = "192.168.0.0/16" }
    benchmark       = { rule = 107, cidr = "198.18.0.0/15" }
    documentation_1 = { rule = 108, cidr = "192.0.2.0/24" }
    documentation_2 = { rule = 109, cidr = "198.51.100.0/24" }
    documentation_3 = { rule = 110, cidr = "203.0.113.0/24" }
    multicast       = { rule = 111, cidr = "224.0.0.0/4" }
    reserved        = { rule = 112, cidr = "240.0.0.0/4" }
  }
}

# The metadata fetcher also rejects these destinations in-process. This subnet
# ACL is an independent guardrail: Torii can reach arbitrary public HTTP(S)
# metadata, but not private or reserved HTTP(S) targets. IMDS remains available
# to the host for its instance role and is separately protected by IMDSv2 plus a
# hop limit of one, which prevents container access.
resource "aws_network_acl" "data" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-data-egress" }
}

resource "aws_network_acl_association" "data" {
  count          = 2
  network_acl_id = aws_network_acl.data.id
  subnet_id      = aws_subnet.data[count.index].id
}

resource "aws_network_acl_rule" "data_deny_private_metadata" {
  for_each = local.metadata_private_cidrs

  network_acl_id = aws_network_acl.data.id
  rule_number    = each.value.rule
  egress         = true
  protocol       = "tcp"
  rule_action    = "deny"
  cidr_block     = each.value.cidr
  from_port      = 80
  to_port        = 443
}

resource "aws_network_acl_rule" "data_allow_rpc_proxy" {
  network_acl_id = aws_network_acl.data.id
  rule_number    = 200
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = aws_vpc.this.cidr_block
  from_port      = 3002
  to_port        = 3002
}

resource "aws_network_acl_rule" "data_allow_internal_responses" {
  network_acl_id = aws_network_acl.data.id
  rule_number    = 201
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = aws_vpc.this.cidr_block
  from_port      = 1024
  to_port        = 65535
}

resource "aws_network_acl_rule" "data_allow_dns" {
  network_acl_id = aws_network_acl.data.id
  rule_number    = 202
  egress         = true
  protocol       = "udp"
  rule_action    = "allow"
  cidr_block     = aws_vpc.this.cidr_block
  from_port      = 53
  to_port        = 53
}

resource "aws_network_acl_rule" "data_allow_time_sync" {
  network_acl_id = aws_network_acl.data.id
  rule_number    = 203
  egress         = true
  protocol       = "udp"
  rule_action    = "allow"
  cidr_block     = "169.254.169.123/32"
  from_port      = 123
  to_port        = 123
}

resource "aws_network_acl_rule" "data_allow_public_web" {
  network_acl_id = aws_network_acl.data.id
  rule_number    = 204
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 80
  to_port        = 443
}

resource "aws_network_acl_rule" "data_allow_api" {
  count = 2

  network_acl_id = aws_network_acl.data.id
  rule_number    = 100 + count.index
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = aws_subnet.app[count.index].cidr_block
  from_port      = 8080
  to_port        = 8080
}

resource "aws_network_acl_rule" "data_allow_tcp_responses" {
  network_acl_id = aws_network_acl.data.id
  rule_number    = 110
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

resource "aws_network_acl_rule" "data_allow_udp_responses" {
  network_acl_id = aws_network_acl.data.id
  rule_number    = 111
  egress         = false
  protocol       = "udp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}
