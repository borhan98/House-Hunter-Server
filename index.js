const express = require("express");
const app = express();
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const bookingCollection = client.db("HouseHunter").collection("bookings");

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
        app.get("/houses", async (req, res) => {
            const priceRange = req.query?.priceRange?.split("-");
            const roomSize = req.query?.roomSize;
            const searchValue = req.query?.searchValue;
            console.log(searchValue);
            const query = {};
            // get house by name
            if (searchValue) {
                query.name = { $regex: searchValue, $options: "i" };
            }
            // get house by roomSize
            if (roomSize) {
                query.room_size = { $regex: roomSize, $options: "i" };
            }
            // get house between a price range
            if (priceRange) {
                if (priceRange[0]) {
                    query.rent_per_month = { $gte: parseFloat(priceRange[0]), $lte: parseFloat(priceRange[1]) }
                }
            }
            const result = await houseCollection.find(query).toArray();
            res.send(result);
        })

        app.get("/houses/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await houseCollection.findOne(query);
            res.send(result);
        })

        app.post("/houses", async (req, res) => {
            const newHouse = req.body;
            const result = await houseCollection.insertOne(newHouse);
            res.send(result);
        })

        app.delete("/houses/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await houseCollection.deleteOne(query);
            res.send(result);
        })

        app.put("/houses/:id", async (req, res) => {
            const updateHouse = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    name: updateHouse.name,
                    address: updateHouse.address,
                    city: updateHouse.city,
                    bedrooms: parseInt(updateHouse.bedrooms),
                    bathrooms: parseInt(updateHouse.bathrooms),
                    room_size: updateHouse.room_size,
                    availability_date: updateHouse.availability_date,
                    rent_per_month: parseFloat(updateHouse.rent_per_month),
                    phone: updateHouse.phone,
                    description: updateHouse.description,
                    photo: updateHouse.photo,
                    email: updateHouse.email,
                    user_name: updateHouse.user_name
                }
            }
            const result = await houseCollection.updateOne(query, updatedDoc, options);
            res.send(result);
        })


        /*-----------------------------------------------
                    Booking Related APIs
        ------------------------------------------------*/
        app.get("/bookings", async (req, res) => {
            const email = req.query?.email;
            const query = { email: email };
            const options = {
                projection: { house_id: 1, email: 1 }
            }
            const result = await bookingCollection.find(query, options).toArray();
            res.send(result);
        })

        app.post("/bookings", async (req, res) => {
            const newBooking = req.body;
            const query = { email: newBooking.email };
            const filter = { house_id: newBooking.house_id };
            const userBookings = await bookingCollection.find(query).toArray();

            // check if user already booked 2 houses
            if (userBookings?.length >= 2) {
                return res.send({ message: "You can't book more than 2 house!" });
            }
            // check if user is going to duplicate booking
            if (userBookings?.length === 1) {
                if (userBookings[0].house_id === newBooking.house_id) {
                    return res.send({ message: "You have already booked this house." })
                }
            }
            const result = await bookingCollection.insertOne(newBooking);
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