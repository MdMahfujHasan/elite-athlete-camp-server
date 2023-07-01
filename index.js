const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
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
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4hbo1s9.mongodb.net/?retryWrites=true&w=majority`;

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
        const paymentCollection = client.db("eliteAthleteDB").collection("payments");

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' });
            res.send(token);
        });

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }

        // ADD verifyJWT, verifyAdmin
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "user already exist" });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // TODO: LEARN, add verifyJWT
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                res.send({ admin: false });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        });

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        // add verifyJWT
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                res.send({ admin: false });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result);
        });

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.patch('/users/role/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $unset: {
                    role: ""
                }
            };
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.get('/classes', async (req, res) => {
            const email = req.query.email;
            if (email) {
                const query = { email: email };
                const result = await classesCollection.find(query).sort({ students: -1 }).toArray();
                res.send(result);
            }
            else {
                const result = await classesCollection.find().sort({ students: -1 }).toArray();
                res.send(result);
            }
        });

        app.post('/classes', async (req, res) => {
            const newClass = req.body;
            const result = classesCollection.insertOne(newClass);
            res.send(result);
        });

        app.put('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const { status, feedback } = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: feedback ? 'denied' : String(status),
                    feedback: feedback && String(feedback)
                }
            };
            const result = await classesCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCollection.deleteOne(query);
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

        // TODO: uncomment
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            // if (email !== req.decoded.email) {
            //     res.status(403).send({ error: true, message: 'Forbidden access' });
            // }
            const query = { email: email };
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartsCollection.insertOne(item);
            res.send(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        });

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });

        app.get('/payment', async (req, res) => {
            const email = req.query.email;
            if (email) {
                const query = { email: email };
                const result = await paymentCollection.find(query).toArray();
                res.send(result);
            }
            else {
                const result = await paymentCollection.find().toArray();
                res.send(result);
            }
        });

        // add verifyJWT
        app.post('/payment', async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);
            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } };
            const deleteResult = await cartsCollection.deleteMany(query);
            res.send({ insertResult, deleteResult });
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