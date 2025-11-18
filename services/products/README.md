# Products Service

Product catalog service with listing, filtering, and image upload capabilities.

## Service Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /products | List products with pagination and search |
| GET | /products/:id | Get single product details |
| GET | /health | Health check |

## Running

```bash
pnpm --filter products dev
```

**What's Next**: Implement image upload endpoint with local storage (S3 notes provided).
