# TLS certificates (RDS)

For **production-grade TLS** to Amazon RDS, download the **RDS global CA bundle**:

- [Using SSL/TLS to connect to DB instances](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- Direct link (subject to change): `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`

Save the file in this directory, for example:

`certs/global-bundle.pem`

Then set in your environment:

```env
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_SSL_CA_PATH=./certs/global-bundle.pem
```

The bundle contains public CAs only; many teams commit it. You may also fetch it in CI/CD instead of storing it in Git.
