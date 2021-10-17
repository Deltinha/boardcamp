import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import connection from './database/database.js';
import dayjs from 'dayjs';

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

const rentalFormat = {
    id: 1,
    customerId: 1,
    gameId: 1,
    rentDate: '2021-06-20',    // data em que o aluguel foi feito
    daysRented: 3,             // por quantos dias o cliente agendou o aluguel
    returnDate: null,          // data que o cliente devolveu o jogo (null enquanto não devolvido)
    originalPrice: 4500,       // preço total do aluguel em centavos (dias alugados vezes o preço por dia do jogo)
    delayFee: null             // multa total paga por atraso (dias que passaram do prazo vezes o preço por dia do jogo)
}

app.post('/rentals', async (req,res) => {
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
    
        const activeRentals = await connection.query(`SELECT * FROM rentals WHERE "gameId"=$1`, [game.rows[0]["id"]]);

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

app.listen(4000);