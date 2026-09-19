# Security Policy

## Reporting vulnerabilities

Do not disclose credentials, tokens, personal data, or exploit details publicly. Report security vulnerabilities privately to the repository maintainers.

## Security expectations

Production deployments must use:
- HTTPS/TLS
- PostgreSQL and Redis with authentication and encryption where supported
- persistent storage
- strong ENCRYPTION_KEY and SESSION_SECRET values
- a WAF/anti-DDoS service at the network edge
- least-privilege infrastructure credentials
- secret management outside source control
- current dependencies and operating-system security updates

The application treats marketplace, WhatsApp, webhook and AI inputs as untrusted data.
