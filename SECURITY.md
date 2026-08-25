# Security Policy

Hemmers takes the security of agent execution and host environments seriously.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within Hemmers, please do **NOT** open a public issue.

Please report security issues privately by contacting the maintainers or via GitHub Security Advisories.

When reporting, please include:
- A description of the vulnerability and its potential impact.
- Steps to reproduce or proof-of-concept code.
- Mitigation suggestions if available.

We will acknowledge receipt within 48 hours and work on a fix promptly.

## Security Architecture Overview

1. **Path Traversal Defense**: All file tools enforce `resolveSafePath()`, preventing access outside the configured `workspaceRoot`.
2. **Command Injection Defense**: Command execution uses `safeSpawn()` without shell concatenation (`shell: false`) and validates against an allowlist.
3. **SSRF Guard**: Default network policies block outbound HTTP requests to private, loopback, and link-local IP addresses (e.g. `127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, `localhost`).
4. **Credential Redaction**: Sensitive headers (`Authorization`, `Cookie`, `X-Api-Key`) and environment variables matching secret patterns are masked in audit logs.
5. **Approval Tokens**: High-risk actions require signed cryptographic tokens validated by the `SecurityEngine`.
6. **Policy Precedence**: `deny` rules always take precedence over `allow` rules.
