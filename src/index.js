import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import connection from './database/database.js';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br.js';

dayjs.locale('pt-br');
const app = express();
app.use(express.json());
app.use(cors());

app.get('/categories', async (req, res) => {
    const categories = await connection.query('SELECT * FROM categories');
    res.send(categories.rows).sendStatus(200);
})

app.post('/categories', async (req, res) => {
    const name = req.body.name;
    try {
        if (name.length === 0) {
            return res.sendStatus(400);
        }

        const duplicateCheck = await connection.query('SELECT * FROM categories WHERE name = $1', [name]);
        if(duplicateCheck.rows.length !== 0) {
            return res.sendStatus(409);
        }

        await connection.query('INSERT INTO categories (name) values ($1)', [name]);
        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.get('/games', async (req, res) => {
    let queryString ='%';
    if (req.query.name !== undefined) {
        queryString = req.query.name;
    }

    try {   
            const games = await connection.query(`
                SELECT 
                    games.*, 
                    categories.name AS "categoryName" 
                FROM games 
                JOIN categories 
                    ON categories.id = games."categoryId" 
                WHERE LOWER(games.name) LIKE LOWER( $1 || '%')
            `,[queryString]);
            
            res.send(games.rows).status(200);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.post('/games', async (req, res) => {
    const {
        name,
        image,
        stockTotal,
        categoryId,
        pricePerDay, 
        } = req.body;

    try {
        const categorySelect = await connection.query('SELECT * FROM categories WHERE id = $1', [categoryId])

        if (name.length === 0 || stockTotal <= 0 || pricePerDay <= 0 || categorySelect.rows.length === 0) {
            return res.sendStatus(400);
        }

        const duplicateCheck = await connection.query('SELECT * FROM games WHERE name = $1', [name]);
        if(duplicateCheck.rows.length !== 0) {
            return res.sendStatus(409);
        }

        await connection.query('INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay" ) values ($1, $2, $3, $4, $5)', [name, image, stockTotal, categoryId, pricePerDay]);
        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.post('/customers', async (req,res) => {
    const user = req.body;
    try {

        const userSchema = Joi.object({
            name: Joi.string().min(1).required(),
            phone: Joi.string().pattern(/^[0-9]{10,11}$/),
            cpf: Joi.string().pattern(/^[0-9]{11}$/),
            birthday: Joi.string().pattern(/^([0-9]{4})-(0[1-9]{1}|1[0-2]{1})-(0[1-9]{1}|[1-2]{1}[0-9]{1}|[3]{1}[0-1]{1})$/),
        })

        const userValidation = userSchema.validate(user);

        if (userValidation.error !== undefined) {
            return res.sendStatus(400);
        }

        const duplicateCheck = await connection.query('SELECT * FROM customers WHERE cpf = $1', [user.cpf]);
        if(duplicateCheck.rows.length !== 0) {
            return res.sendStatus(409);
        }

        await connection.query('INSERT INTO customers (name, phone, cpf, birthday ) values ($1, $2, $3, $4)', [user.name, user.phone, user.cpf, user.birthday]);
        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.get('/customers', async (req, res) => {
    let queryString ='%';
    if (req.query.cpf !== undefined) {
        queryString = req.query.cpf;
    }

    try {   
            const games = await connection.query(`
                SELECT * FROM customers 
                WHERE cpf LIKE $1 || '%'
            `,[queryString]);
            
            res.send(games.rows).status(200);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.get('/customers/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const customer = await connection.query('SELECT * FROM customers WHERE id=$1', [id]);
        
        if (customer.rows.length === 0) {
            res.sendStatus(404);
        }

        res.send(customer.rows[0]).sendStatus(200);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.post('/rentals', async (req, res) => {
    const {
        customerId,
        gameId,
        daysRented,
    } = req.body;
    
    const rentDate = dayjs();
    try {
        const game = await connection.query('SELECT * FROM games WHERE id=$1', [gameId]);
        const customer = await connection.query('SELECT * FROM customers WHERE id=$1', [customerId]);

        if (game.rows.length === 0 || customer.rows.length === 0 || daysRented <= 0) {
            return res.sendStatus(400);
        }
    
        const activeRentals = await connection.query(`
            SELECT * FROM rentals 
            WHERE "gameId"=$1
            AND "returnDate" IS NULL`, [game.rows[0]["id"]]);

        if (activeRentals.rows.length >= game.rows[0]['stockTotal']) {
            return res.sendStatus(400);
        }

        const pricePerDay = game.rows[0]['pricePerDay'];
        const originalPrice = pricePerDay * daysRented;

        await connection.query(`
            INSERT INTO rentals (
                "customerId",
                "gameId",
                "rentDate",
                "daysRented",
                "returnDate",
                "originalPrice",
                "delayFee"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,[customerId, gameId, rentDate, daysRented, null, originalPrice, null]);

        res.sendStatus(201);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
    
})

app.get('/rentals', async (req, res) => {
    const possibleKeys = ['customerId', 'gameId'];
    const queryKeys = Object.keys(req.query);
    const queryValues = {};

    possibleKeys.forEach(key => {
        queryValues[key] = '%';
    });

    if (queryKeys.length > 0) {
        queryKeys.forEach(key => {
            queryValues[key] = req.query[key];
        });
    }

    try {   
        const rentals = await connection.query(`
            SELECT * FROM rentals 
            WHERE "customerId"::text LIKE $1 
            AND "gameId"::text LIKE $2

        `,[ queryValues.customerId, queryValues.gameId ]);

        res.send(rentals.rows).status(200);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.post('/rentals/:id/return', async (req, res) => {
    const id = req.params.id;
    const todaysDate = dayjs();
    let delayFee = 0;

    try {
        
        const rental = await connection.query(`SELECT * FROM rentals WHERE id = $1`, [id]);
        if (rental.rows.length === 0) {
            return res.sendStatus(404);
        }

        if (rental.rows[0]['returnDate'] !== null) {
            return res.sendStatus(400)
        }

        const {
            rentDate, 
            gameId,
            daysRented
        } = rental.rows[0];

        const returnDate = dayjs(rentDate).add(daysRented, 'day');

        const game = await connection.query(`SELECT * FROM games WHERE id = $1`,[gameId]);
        const {pricePerDay} = game.rows[0];
        
        const delay = parseInt((todaysDate - returnDate)  / (1000 * 60 * 60 * 24));
        console.log(delay)
        
        if (delay > 0) {
            delayFee = pricePerDay * delay;
        }

        await connection.query(`UPDATE rentals SET "returnDate" = $1 WHERE id = $2`,[todaysDate.format('YYYY-MM-DD'), id]);
        await connection.query(`UPDATE rentals SET "delayFee" = $1 WHERE id = $2`,[delayFee, id]);

        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.listen(4000);