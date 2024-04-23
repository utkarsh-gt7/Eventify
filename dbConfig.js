import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

db.connect();


const createStudentTableQuery = `
    CREATE TABLE IF NOT EXISTS student (
        id SERIAL PRIMARY KEY,
        reg_no INTEGER, 
        name VARCHAR(100),
        password TEXT,
        email VARCHAR(254) UNIQUE,
        phone VARCHAR(16),
        course  VARCHAR(30),
        grav_url TEXT,
        user_type VARCHAR(30)  DEFAULT 'student',
        passing_year  INTEGER,
        interests TEXT[]
    )
`;

const createOrganisationTableQuery = `
    CREATE TABLE IF NOT EXISTS organisation (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        password TEXT,
        email VARCHAR(254) UNIQUE,
        logo_url  VARCHAR(256),
        about TEXT,
        year_established  INTEGER,
        type TEXT[],
        user_type  VARCHAR(30)  DEFAULT 'organisation'
    )
`;

const createEventTableQuery = `
    CREATE TABLE IF NOT EXISTS event (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        categories TEXT[],
        org_id INTEGER,
        start_date TEXT,
        end_date TEXT,
        location VARCHAR(100),
        description TEXT,
        status VARCHAR(50) DEFAULT 'aboutTo',
        img_url TEXT
    )
`;

const createReviewTableQuery = `
    CREATE TABLE IF NOT EXISTS review (
        id SERIAL PRIMARY KEY,
        org_id INTEGER,
        event_id INTEGER,
        student_id INTEGER,
        rating SMALLINT CHECK(rating >= 0 AND rating <= 5),
        comment TEXT
    )
`;

const createRegistrationTableQuery = `
    CREATE TABLE IF NOT EXISTS registration (
        id SERIAL PRIMARY KEY,
        org_id INTEGER,
        event_id INTEGER,
        student_id INTEGER
    )
`;

db.query(createStudentTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'student' table", err);
    } else {
        console.log("Table 'student' created successfully");
    }
});

db.query(createRegistrationTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'registration' table", err);
    } else {
        console.log("Table 'registration' created successfully");
    }
});

db.query(createEventTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'event' table", err);
    } else {
        console.log("Table 'event' created successfully");
    }
});

db.query(createOrganisationTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'organisation' table", err);
    } else {
        console.log("Table 'organisation' created successfully");
    }
});

db.query(createReviewTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'review' table", err);
    } else {
        console.log("Table 'review' created successfully");
    }
});

export default db;