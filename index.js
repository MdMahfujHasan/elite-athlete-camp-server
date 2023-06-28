const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized access" });
    }
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4hbo1s9.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const usersCollection = client.db("eliteAthleteDB").collection("users");
        const classesCollection = client.db("eliteAthleteDB").collection("classes");
        const detailedClassesCollection = client.db("eliteAthleteDB").collection("detailedClasses");
        const instructorsCollection = client.db("eliteAthleteDB").collection("instructors");
        const cartsCollection = client.db("eliteAthleteDB").collection("carts");

        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User already exist" });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().sort({ students: -1 }).toArray();
            res.send(result);
        });

        app.get('/detailed-classes', async (req, res) => {
            const result = await detailedClassesCollection.find().toArray();
            res.send(result);
        });

        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().sort({ students: -1 }).toArray();
            res.send(result);
        });

        app.get('/carts', async (req, res) => {
            const result = await cartsCollection.find().toArray();
            res.send(result);
        });

        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartsCollection.insertOne(item);
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('elite athlete camp server running');
});

app.listen(port, () => {
    console.log(`listening on port: ${port}`);
});