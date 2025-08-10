require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
const cors = require("cors");

const corsConfig = {
  origin: "*",
  Credential: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.options("", cors(corsConfig));
app.use(cors(corsConfig));
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.get("/", (req, res) => {
  res.send("Food API is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0zma47h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyFBToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const verifyFBemail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

async function run() {
  try {
    client.connect();
    const foods = client.db("Foods").collection("foodCollection");
    const notes = client.db("Foods").collection("notes");

    app.get("/foods", async (req, res) => {
      const result = await foods.find().toArray();
      res.send(result);
    });

    app.get("/myitems", verifyFBToken, verifyFBemail, async (req, res) => {
      const email = req.query.email;
      const result = await foods.find({ email }).toArray();
      res.send(result);
    });

    app.get("/foods/nearlyExFoods", async (req, res) => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      const future = new Date();
      future.setDate(today.getDate() + 5);
      const futureStr = future.toISOString().split("T")[0];

      const query = {
        expiry_date: { $gte: todayStr, $lte: futureStr },
      };

      const result = await foods.find(query).sort({ expiry_date: 1 }).toArray();
      res.send(result);
    });

    app.get("/foods/expiredFoods", async (req, res) => {
      const today = new Date().toISOString().split("T")[0];
      const result = await foods
        .find({ expiry_date: { $lt: today } })
        .toArray();
      res.send(result);
    });

    app.get("/foods/expiredFoods/:id", async (req, res) => {
      const id = req.params.id;
      const result = await foods.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const result = await foods.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post("/foods", async (req, res) => {
      const newFood = req.body;
      const result = await foods.insertOne(newFood);
      res.send(result);
    });

    app.put("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: req.body };
      const options = { upsert: true };
      const result = await foods.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.delete("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const result = await foods.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/notes", async (req, res) => {
      const result = await notes.find().toArray();
      res.send(result);
    });

    app.post("/notes", async (req, res) => {
      const newNote = { ...req.body, createdAt: new Date() };
      const result = await notes.insertOne(newNote);
      res.send(result);
    });

    console.log();
  } finally {
  }
}

run();

app.listen(port, () => {
  console.log(` Server is running  ${port}`);
});
