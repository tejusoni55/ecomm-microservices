// Products service: list and filter products (raw SQL with pg)
import express from "express";
import { getDb } from "@ecomm/db";
import logger from "@ecomm/logger";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  publishProductCreated,
  publishProductUpdated,
} from "../kafka-producer.js";

const router = express.Router();

// GET / - List all products with optional filtering
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status = "active" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const pool = getDb();

    const whereClauses = [];
    const params = [];

    params.push(status);
    whereClauses.push(`status = $${params.length}`);

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      whereClauses.push(
        `(name ILIKE $${params.length - 1} OR description ILIKE $${
          params.length
        })`
      );
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const listSql = `SELECT * FROM products ${whereSql} ORDER BY created_at DESC LIMIT $${
      params.length + 1
    } OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const { rows: products } = await pool.query(listSql, params);

    // Count
    const countParams = params.slice(0, params.length - 2);
    const countSql = `SELECT COUNT(*)::int as count FROM products ${whereSql}`;
    const { rows: countRows } = await pool.query(countSql, countParams);
    const total = countRows[0] ? countRows[0].count : 0;

    res.json({
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error("Error listing products", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:id - Get single product
router.get("/:id", async (req, res) => {
  try {
    const pool = getDb();
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [
      req.params.id,
    ]);
    const product = rows[0];

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    logger.error("Error getting product", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST / - Create new product (admin only)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      sku,
      image_url,
      status = "active",
    } = req.body;

    // Validation
    if (!name || !price || !sku) {
      return res
        .status(400)
        .json({ error: "Name, price, and SKU are required" });
    }

    if (price <= 0) {
      return res.status(400).json({ error: "Price must be greater than 0" });
    }

    if (stock < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    const pool = getDb();

    // Check if SKU already exists
    const existingProduct = await pool.query(
      "SELECT id FROM products WHERE sku = $1",
      [sku]
    );
    if (existingProduct.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "Product with this SKU already exists" });
    }

    // Insert product
    const insertSql = `
      INSERT INTO products (name, description, price, stock, sku, image_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await pool.query(insertSql, [
      name,
      description || null,
      price,
      stock || 0,
      sku,
      image_url || null,
      status,
    ]);

    const product = rows[0];

    // Publish product.created event
    await publishProductCreated(product);

    logger.info(
      `Product created: ${product.name} (ID: ${product.id}, SKU: ${sku})`
    );

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    logger.error("Error creating product", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /:id - Update product (admin only)
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, image_url, status } = req.body;
    const productId = req.params.id;

    const pool = getDb();

    // Check if product exists
    const existingProduct = await pool.query(
      "SELECT * FROM products WHERE id = $1",
      [productId]
    );
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (price !== undefined) {
      if (price <= 0) {
        return res.status(400).json({ error: "Price must be greater than 0" });
      }
      updates.push(`price = $${paramIndex++}`);
      values.push(price);
    }
    if (stock !== undefined) {
      if (stock < 0) {
        return res.status(400).json({ error: "Stock cannot be negative" });
      }
      updates.push(`stock = $${paramIndex++}`);
      values.push(stock);
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(image_url);
    }
    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return res
          .status(400)
          .json({ error: 'Status must be "active" or "inactive"' });
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Add updated_at and product id
    updates.push(`updated_at = NOW()`);
    values.push(productId);

    const updateSql = `
      UPDATE products
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const { rows } = await pool.query(updateSql, values);
    const product = rows[0];

    // Publish product.updated event
    await publishProductUpdated(product);

    logger.info(`Product updated: ${product.name} (ID: ${product.id})`);

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    logger.error("Error updating product", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
