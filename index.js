const express = require("express");
const app = express();
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cewmzm0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // all collections
        const userCollection = client.db("HouseHunter").collection("users");
        const houseCollection = client.db("HouseHunter").collection("houses");

        // verify token
        const verifyToken = async (req, res, next) => {
            const token = req.headers?.authorization?.split(" ")[1];
            if (!token) {
                return res.status(401).send({ message: "Unauthorized access" });
            }
            jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "Unauthorized access" });
                }
                req.decoded = decoded;
                next();
            })
        }


        /*-----------------------------------------------
                    User Related APIs
        ------------------------------------------------*/
        app.get("/user", verifyToken, async (req, res) => {
            // TODO: when user login, then load the specific user's data
            const user = req.decoded;
            const query = { email: user?.email };
            const result = await userCollection.findOne(query);
            res.send(result);
        })

        app.post("/register", async (req, res) => {
            let newUser = req.body;
            const query = { email: newUser.email }
            const user = await userCollection.findOne(query);
            if (user?.email) {
                return res.send({ message: "User already exists" })
            }

            // Secure password with bcrypt
            const hashedPass = await bcrypt.hash(newUser.password, 10);
            newUser.password = hashedPass;
            const result = await userCollection.insertOne(newUser);
            res.send(result)
        })

        app.post("/login", async (req, res) => {
            const { email, password } = req.body;
            const query = { email };
            const user = await userCollection.findOne(query);
            if (!user) {
                return res.send({ message: "Invalid Username" });
            }

            // Check the password
            const validPass = await bcrypt.compare(password, user.password);
            if (!validPass) {
                return res.send({ message: "Invalid password" });
            }
            // Generate token
            const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: "1h" });
            res.send({ token, user });
        })

        /*-----------------------------------------------
                    House Related APIs
        ------------------------------------------------*/
        app.post("/houses", async (req, res) => {
            const newHouse = req.body;
            const result = await houseCollection.insertOne(newHouse);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);




app.get("/", (req, res) => {
    res.send("House Hunter server is running...");
})
app.listen(port, () => {
    console.log("House Hunter server is running on port:", port);
})