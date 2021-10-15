import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(cors());

const connection = new Pool({
    user: 'bootcamp_role',
    password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp',
    host: 'localhost',
    port: 5432,
    database: 'boardcamp'
});

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

app.listen(4000);