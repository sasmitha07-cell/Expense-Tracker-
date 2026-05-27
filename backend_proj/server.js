// =============================
// Expense Tracker Backend (server.js)
// =============================

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json());

// =============================
//  MySQL CONNECTION
// =============================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "expense_tracker",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message || err);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL Database");
});

// =============================
//  USER AUTH & PROFILE ROUTES
// =============================

// --- Signup ---
app.post("/users", async (req, res) => {
  const { name, username, email, age, gender, password } = req.body;

  if (!name || !username || !email || !gender || !password)
    return res.status(400).json({ error: "Please fill all required fields." });

  try {
    const checkSql = "SELECT id FROM users WHERE username = ? OR email = ?";
    db.query(checkSql, [username, email], async (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      if (results.length > 0)
        return res
          .status(400)
          .json({ error: "Username or email already exists." });

      const hashed = await bcrypt.hash(password, 10);
      const insertSql =
        "INSERT INTO users (name, username, email, age, gender, password) VALUES (?, ?, ?, ?, ?, ?)";
      db.query(
        insertSql,
        [name, username, email, age || null, gender, hashed],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res
            .status(201)
            .json({ message: "Account created!", userId: result.insertId });
        }
      );
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Login ---
app.post("/login", (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password)
    return res.status(400).json({ error: "Missing credentials." });

  const sql =
    "SELECT id, name, username, email, age, gender, password FROM users WHERE username = ? OR email = ?";
  db.query(sql, [usernameOrEmail, usernameOrEmail], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(401).json({ error: "Invalid credentials." });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials." });

    delete user.password; // Don’t send password back
    res.json({ message: "Login successful", user });
  });
});

// --- Get User Profile ---
app.get("/user/:id", (req, res) => {
  const { id } = req.params;
  db.query(
    "SELECT id, name, username, email, age, gender FROM users WHERE id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0)
        return res.status(404).json({ error: "User not found" });
      res.json(results[0]);
    }
  );
});

// --- Update User Profile ---
app.put("/user/:id", (req, res) => {
  const { id } = req.params;
  const { name, username, email, age, gender } = req.body;

  const sql = `
    UPDATE users
    SET name = ?, username = ?, email = ?, age = ?, gender = ?
    WHERE id = ?
  `;
  db.query(sql, [name, username, email, age, gender, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "✅ Profile updated successfully!" });
  });
});

// =============================
//  EXPENSE ROUTES
// =============================

// --- Add Expense ---
app.post("/add-expense", (req, res) => {
  const { user_id, title, amount, date, category, notes } = req.body;
  if (!user_id || !title || !amount || !date)
    return res.status(400).json({ error: "Missing required fields." });

  const sql =
    "INSERT INTO expenses (user_id, title, amount, date, category, notes) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(
    sql,
    [user_id, title, amount, date, category || "Others", notes || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res
        .status(201)
        .json({ message: "Expense added!", expenseId: result.insertId });
    }
  );
});

// --- Get User's Expenses ---
app.get("/get-expenses/:user_id", (req, res) => {
  const { user_id } = req.params;
  const sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC";
  db.query(sql, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// --- Update Expense ---
app.put("/update-expense/:expense_id", (req, res) => {
  const { expense_id } = req.params;
  const { title, amount, date, category, notes } = req.body;

  const sql = `
    UPDATE expenses 
    SET title = ?, amount = ?, date = ?, category = ?, notes = ?
    WHERE expense_id = ?
  `;
  db.query(sql, [title, amount, date, category, notes, expense_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "✅ Expense updated successfully!" });
  });
});

// --- Delete Expense ---
app.delete("/delete-expense/:user_id/:expense_id", (req, res) => {
  const { user_id, expense_id } = req.params;
  const sql = "DELETE FROM expenses WHERE expense_id = ? AND user_id = ?";
  db.query(sql, [expense_id, user_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0)
      return res.status(403).json({ error: "You cannot delete this expense." });
    res.json({ message: "Expense deleted!" });
  });
});

// =============================
//  PAY LATER ROUTES
// =============================

// --- Add Pay Later ---
app.post("/paylater", (req, res) => {
  const { user_id, to_whom, amount, deadline, note } = req.body;
  if (!user_id || !to_whom || !amount || !deadline)
    return res.status(400).json({ error: "Missing required fields." });

  const sql =
    "INSERT INTO pay_later (user_id, to_whom, amount, deadline, note, status) VALUES (?, ?, ?, ?, ?, 'Pending')";
  db.query(
    sql,
    [user_id, to_whom, amount, deadline, note || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res
        .status(201)
        .json({ message: "Pay Later added!", pay_id: result.insertId });
    }
  );
});

// --- Get Pay Later List ---
app.get("/paylater/:user_id", (req, res) => {
  const { user_id } = req.params;
  const sql = "SELECT * FROM pay_later WHERE user_id = ? ORDER BY deadline ASC";
  db.query(sql, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// --- Mark as Paid ---
app.put("/paylater/mark-paid/:id", (req, res) => {
  const { id } = req.params;
  const sql = "UPDATE pay_later SET status = 'Paid' WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Marked as Paid" });
  });
});

// --- Delete Pay Later ---
app.delete("/paylater/:id/:user_id", (req, res) => {
  const { id, user_id } = req.params;
  const sql = "DELETE FROM pay_later WHERE id = ? AND user_id = ?";
  db.query(sql, [id, user_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0)
      return res.status(403).json({ error: "You cannot delete this record." });
    res.json({ message: "Deleted successfully" });
  });
});
// --- Expense Summary (Weekly / Monthly / Yearly) ---
app.get("/expense-summary/:user_id", (req, res) => {
  const { user_id } = req.params;
  const { range } = req.query;

  let sql = "";

  if (range === "weekly") {
    sql = `
      SELECT DATE_FORMAT(date, '%Y-%m-%d') AS label, SUM(amount) AS total
      FROM expenses
      WHERE user_id = ?
        AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(date, '%Y-%m-%d');
    `;
  } else if (range === "monthly") {
    sql = `
      SELECT DATE_FORMAT(date, '%Y-%m') AS label, SUM(amount) AS total
      FROM expenses
      WHERE user_id = ?
        AND date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY DATE_FORMAT(date, '%Y-%m');
    `;
  } else {
    sql = `
      SELECT YEAR(date) AS label, SUM(amount) AS total
      FROM expenses
      WHERE user_id = ?
      GROUP BY YEAR(date)
      ORDER BY YEAR(date);
    `;
  }

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("❌ Error fetching summary:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json({
      labels: results.map((r) => r.label),
      values: results.map((r) => parseFloat(r.total)), // 👈 renamed for frontend
    });
  });
});
// =============================
// DELETE USER ACCOUNT
// =============================
app.delete("/delete-account/:id", (req, res) => {
  const { id } = req.params;

  // Step 1 — Delete all expenses of the user
  db.query("DELETE FROM expenses WHERE user_id = ?", [id], (err) => {
    if (err)
      return res.status(500).json({ error: "Failed to delete expenses." });

    // Step 2 — Delete the user
    db.query("DELETE FROM users WHERE id = ?", [id], (err2, result) => {
      if (err2)
        return res.status(500).json({ error: "Failed to delete user." });

      if (result.affectedRows === 0)
        return res.status(404).json({ error: "User not found." });

      // Final response
      res.json({ message: "Account deleted successfully!" });
    });
  });
});

// =============================
//  HEALTH CHECK
// =============================
app.get("/", (req, res) => res.json({ status: "ok" }));

// =============================
//  START SERVER
// =============================
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
