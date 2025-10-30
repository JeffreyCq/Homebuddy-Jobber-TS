import express from "express";
import dotenv from "dotenv";
import routes from "./routes/index.js";
import bodyParser from "body-parser";

dotenv.config();

const app = express();

// Raw body for Jobber webhooks ONLY
app.use("/webhooks/jobber", bodyParser.raw({ type: "*/*" }));

// JSON for the rest
app.use(express.json());

// Routes
app.use(routes);

// Health
app.get("/healthz", (_, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));