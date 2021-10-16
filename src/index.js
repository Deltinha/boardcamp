import express from 'express';
import cors from 'cors';
import connection from './database/database.js';

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

        await connection.query('SELECT * FROM categories');
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

        await connection.query('SELECT * FROM games');
        await connection.query('INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay" ) values ($1, $2, $3, $4, $5)', [name, image, stockTotal, categoryId, pricePerDay]);
        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.listen(4000);