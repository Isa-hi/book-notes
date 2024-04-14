import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import axios from 'axios';
import methodOverride from 'method-override';

const urlApi = 'https://covers.openlibrary.org/b/'

const app = express();
const port = 3000;

const db = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'book_notes',
    password: 'admin',
    port: 5432,
});

/* Middleware */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
// Parses the post request to a put request
app.use(methodOverride('_method'));

db.connect();

app.get('/', async (req, res) => {
    // END POINT TO SHOW ALL BOOKS
    const response = await db.query('SELECT * FROM book INNER JOIN book_review ON book.id = book_review.book_id ORDER BY book.id ASC');
    const books = response.rows;
    
    res.render("index.ejs", { books });
});

app.get('/view-review', async (req, res) => {
    // END POINT TO SHOW EDIT PAGE FOR A SELECTED BOOK
    const id = req.query.id;
    const response = await db.query('SELECT * FROM book INNER JOIN book_review ON book.id = book_review.book_id WHERE book.id = $1', [id]);
    const selected_book = response.rows[0];
    res.render('new.ejs', { selected_book });
});

app.get('/edit', async (req, res) => {
    res.render("new.ejs", { book: selected_book });
});

// END POINT TO UPDATE A BOOK
app.post('/edit', async (req, res) => {
    // Method-Override changes the POST request to a PUT request but 
    // because it's send like a POST, we need to handle it like a POST first

    // Request is a JSON with the book data to update
    const request = req.body;

    try {
        await db.query('UPDATE book SET title = $1 WHERE id = $2', [request.title, parseInt(request.id)]);
        await db.query('UPDATE book_review SET fullreview = $1, rating = $2 WHERE book_id = $3', [request.full_review, request.rating, request.id]);
        console.log('Book and Review updated in database');
        console.log();    
    } catch (error) {
        console.log("Error updating book: ", error);
        //res.status(500).send('Internal Server Error');
    }
    
    res.redirect('/');
});

app.post('/new', async (req, res) => {
    // END POINT TO ADD A NEW BOOK
    const key = 'isbn';
    const value = req.body.book_value;
    const size = 'M';
    const response = await axios.get(`${urlApi}${key}/${value}-${size}.jpg`);
    const imgResponse = response.config.url;
    const dataBase_data = {
        title: req.body.title,
        book_cover_url: imgResponse,
        creation_date: new Date().toISOString().slice(0, 10),
        full_review: req.body.full_review,
        rating: req.body.rating,
    }
    try {
        //Insert into book table
        const book = await db.query('INSERT INTO book (title, book_cover_url) VALUES ($1, $2) RETURNING *', [dataBase_data.title, dataBase_data.book_cover_url]);
        //Insert into review table
        await db.query('INSERT INTO book_review (book_id, fullreview, creation_date, rating) VALUES ($1, $2, $3, $4) RETURNING *', [book.rows[0].id, dataBase_data.full_review, dataBase_data.creation_date, dataBase_data.rating]);
        console.log('Book and Review added to database');
        res.redirect('/');
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
});
