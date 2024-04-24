import express from "express";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import session from "express-session";
import flash from "express-flash";
import passport from "passport";
import {initializeStudent} from "./passportConfig.js"
import { initializeORG } from "./passportConfig1.js";
import db from "./dbConfig.js";
import gravatar from "gravatar";

const PORT = 3000;
const app = express();

app.use(express.static("public"));
app.use(express.static("views"));
app.use(express.static("assets"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(
    session({
      secret: "secret",
      resave: false,
      saveUninitialized: false
    })
  );
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//Email functionality.
const my_email = process.env.MY_EMAIL;
const my_pass = process.env.MY_PASS;

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: my_email,
        pass: my_pass
    }
});

function sendMail(name, Semail, subject, message) {
    return new Promise((resolve, reject) => {
      const mailOptions = {
        from: Semail,
        to: my_email,
        subject: subject + ' Message from ' + name,
        text: message + ' from ' + Semail
      };
  
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
          reject(false);
        } else {
          console.log('Email sent: ' + info.response);
          resolve(true);
        }
      });
    });
}

app.post("/contact-me", checkNotAuthenticated, async (req, res) => {
    const name = req.body.name;
    const Semail = req.body.email;
    const subject = req.body.subject;
    const message = req.body.message;

    try {
        // Send email and get the result
        const emailSent = await sendMail(name, Semail, subject, message);
    
        // Respond to the client based on the result
        res.render("contact.ejs", {message: "Sent!", user: req.user});
      } catch (error) {
        // Handle any unexpected errors
        console.error(error);
        res.render("contact.ejs", {message: "Try_Again!", user: req.user});
      }  
});

app.use('/login', checkAuthenticated, (req, res, next) => {
    // Assuming user_type is sent in the request body
    if (req.body.user_type === 'organisation') {
        initializeORG(passport);
    }else if (req.body.user_type === 'student') {
        initializeStudent(passport);
    }
    next();
});

app.post("/login", (req, res, next) => {
    if (req.body.user_type === 'organisation') {
        initializeORG(passport);
        passport.authenticate("organisation", (err, user, info) => {
            console.log("INside ORG");
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.redirect('/');
            }
            // Assuming user_type is sent in the request body
            
            req.logIn(user, (err) => {
                if (err) {
                    return next(err);
                }
                return res.redirect('/home');
            });
        })(req, res, next);
    } else if (req.body.user_type === 'student') {
        initializeStudent(passport);
        console.log("Inside stu");
        passport.authenticate("student", (err, user, info) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.redirect('/');
            }
            // Assuming user_type is sent in the request body
            
            req.logIn(user, (err) => {
                if (err) {
                    return next(err);
                }
                return res.redirect('/home');
            });
        })(req, res, next);
    }
    
});


app.get("/", checkAuthenticated, (req, res) => {
    res.render("login.ejs");
})

app.get("/home", checkNotAuthenticated, async (req, res) => {
    const result = await db.query('SELECT * FROM event');
    res.render("index.ejs", {events: result.rows, user: req.user});
})

// app.get("/ticket", (req, res) => {
//     res.render("ticket.ejs");
// })

// app.get("/elements", (req, res) => {
//     res.render("elements.ejs");
// })

app.get("/contact", checkNotAuthenticated, (req, res) => {
    res.render("contact.ejs", {user: req.user});
})

app.get("/upcoming", checkNotAuthenticated, async (req, res) => {
    let results = await db.query('SELECT * FROM event');
    let  events = results.rows;
    res.render("upcoming.ejs", {events: events, user: req.user});
})

app.post("/search", checkNotAuthenticated, async (req, res) => {
    let results = await db.query(`
    SELECT *
    FROM event
    WHERE lower(name) LIKE '%' || lower($1) || '%'
    OR lower($1) IN (
    SELECT lower(unnest(categories)))
  `, [req.body.search]);
    console.log(results.rows[0]);
    res.render("upcoming.ejs", {events: results.rows, user: req.user});
})

app.get("/aboutus", checkNotAuthenticated, (req, res) => {
    res.render("about-us.ejs", {user: req.user});
})

app.get("/registerORG", (req, res) => {
    res.render("registerORG.ejs");
})

app.get("/registerStudent", (req, res) => {
    res.render("signIn.ejs");
})

app.get("/create-event", checkNotAuthenticated, isOrganisation, (req, res) => {
    res.render("create-event.ejs", {user: req.user})
})

app.get("/see-event", checkNotAuthenticated, async (req, res) => {
    let result = await db.query('SELECT * FROM event WHERE id = $1', [req.query.id]);
    console.log(result.rows[0]);
    res.render("see-event.ejs", {event : result.rows[0], user: req.user});
})

app.get("/orgDashboard", checkNotAuthenticated, isOrganisation, async (req, res) => {
    let aboutORG = await db.query('SELECT * FROM organisation WHERE id = $1', [req.user.id]);
    let reg = await db.query('SELECT * FROM event WHERE org_id = $1', [req.user.id]);
    let events = await db.query('SELECT * FROM event WHERE org_id = $1', [req.user.id]);

    let eventArray = [];
    for (let i = 0; i < events.rows.length; i++) {
        const event = events.rows[i];
        // Fetch students registered for the current event
        const registeredStudents = await db.query(`
    SELECT DISTINCT student.id, student.reg_no, student.name, student.email, student.phone, student.course
    FROM student
    INNER JOIN registration ON student.id = registration.student_id
    WHERE registration.event_id = $1
`, [event.id]);

        // Push an object containing event details and registered students to the array
        console.log(registeredStudents.rows);
        eventArray.push({
            event_details: event,
            registered_students: registeredStudents.rows
        });
    }

    res.render("orgDash.ejs", {about: aboutORG.rows[0], reg: reg.rows.length, eventsNo: events.rows.length, events: events.rows, eventArray: eventArray, user: req.user});
})

app.get("/studentDash", checkNotAuthenticated, isStudent, async (req, res) => {
    try {
        const registeredEvents = await db.query(`
        SELECT DISTINCT event.id, event.name, event.categories, event.start_date, event.end_date, event.location, event.description, event.img_url
        FROM event
        INNER JOIN registration ON event.id = registration.event_id
        WHERE registration.student_id = $1
    `, [req.user.id]); 
        // Create an array to store structured data for each registered event
        const eventArray = [];

        // Iterate over each registered event
        for (let i = 0; i < registeredEvents.rows.length; i++) {
            const event = registeredEvents.rows[i];
            
            // Push an object containing event details to the array
            eventArray.push({
                event_details: event
            });
        }

        // Render the studentDash.ejs template with the structured data
        res.render("stuDash.ejs", {
            event: eventArray, user: req.user
        });
    } catch (err) {
        console.error("Error:", err);
        // Handle error
        res.status(500).send("Internal Server Error");
    }
});

app.post("/login", passport.authenticate("local", {
    successRedirect:"/home",
    failureRedirect:'/',
    failureFlash: true
  }));

app.post("/registerStudent", async (req, res) => {
    console.log("Inside register");
    console.log(req.body);
    const keywords = req.body.keywords.split(',').map(keyword => keyword.trim());
    console.log('Received keywords:', keywords);

    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const password2 = req.body.password1;
    const reg = req.body.id;
    const phone = req.body.phone;
    const course = req.body.course;
    const year = req.body.year;
    console.log(req.body);

    //Form Validation steps
    let errors = [];
    if(!name || !email || !password || !password2 || !reg || !phone || !course || !year){
        errors.push({message:"Please fill in all fields."});
    }
    if(password !== password2){
        errors.push({message: "Passwords do not match"});
    }
    if(password.length < 6){
        errors.push( { message: "Password must be at least 6 characters long."})
    }
    if(errors.length > 0){
        res.render('registration', {errors});
    }else{
      //Form validation has passed, generating a hash for the user.
      let hashedPassword;
      let gravatarUrl;
      try {
        gravatarUrl = gravatar.url(email, { s: '200', d: 'identicon', r: 'pg' });
        hashedPassword = await new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    console.log('Hashed Password: ', hash);
                    resolve(hash);
                }
            });
        });
  
        console.log("outside");
        console.log(hashedPassword);
      } catch (error) {
          // Handle errors here
          console.error(error);
          res.render('error', { message: 'Internal Server Error' });
      }
      let result = await db.query('SELECT * FROM student WHERE email = $1', [email], (err, results)=>{
          if(err){
              console.error(err);
          }else{
              console.log(results.rows);
              if(results.rows.length > 0){
                  errors.push({message:  'Email already exists.'});
                  res.render("signIn.ejs", {errors})
              }else{
                  result = db.query(
                      'INSERT INTO student (name, email, password, grav_url, reg_no, phone, course, passing_year, interests) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, password',
                      [name, email, hashedPassword, gravatarUrl, reg, phone, course, year, keywords],
                      (err, results) => {
                          if(err){
                              throw err;
                          }
                          console.log(results.rows);
                          req.flash('success_msg','You are now registered and can log in');
                          res.redirect("/");
                      }
                  )
              }
          }
      })
    }
})

app.post("/registerORG", async (req, res) => {
    console.log("Inside registerORG");
    const keywords = req.body.keywords.split(',').map(keyword => keyword.trim());
    console.log('Received keywords:', keywords);

    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const password2 = req.body.password1;
    const logo = req.body.logo;
    const about = req.body.about;
    const year = req.body.year;
    console.log(req.body);

    //Form Validation steps
    let errors = [];
    if(!name || !email || !password || !password2 || !logo || !about || !year){
        errors.push({message:"Please fill in all fields."});
    }
    if(password !== password2){
        errors.push({message: "Passwords do not match"});
    }
    if(password.length < 6){
        errors.push( { message: "Password must be at least 6 characters long."})
    }
    if(errors.length > 0){
        res.render('registerORG.ejs', {errors});
    }else{
      //Form validation has passed, generating a hash for the user.
      let hashedPassword;
      try {
        hashedPassword = await new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    console.log('Hashed Password: ', hash);
                    resolve(hash);
                }
            });
        });
        console.log("outside");
        console.log(hashedPassword);
      } catch (error) {
          // Handle errors here
          console.error(error);
          res.render('error', { message: 'Internal Server Error' });
      }
      let result = await db.query('SELECT * FROM organisation WHERE email = $1', [email], (err, results)=>{
          if(err){
              console.error(err);
          }else{
              console.log(results.rows);
              if(results.rows.length > 0){
                  errors.push({message:  'Email already exists.'});
                  res.render("signIn.ejs", {errors})
              }else{
                  result = db.query(
                      'INSERT INTO organisation (name, email, password, logo_url, about, year_established, type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, password',
                      [name, email, hashedPassword, logo, about, year, keywords],
                      (err, results) => {
                          if(err){
                              throw err;
                          }
                          console.log(results.rows);
                          req.flash('success_msg','You are now registered and can log in');
                          res.redirect("/");
                      }
                  )
              }
          }
      })
    }
})

app.post("/create-event", checkNotAuthenticated, isOrganisation, (req, res) => {
    const name = req.body.name;
    const begin = req.body.begin;
    const end = req.body.end;
    const venue = req.body.venue;
    const keywords = req.body.keywords.split(',');
    const  description = req.body.desc;
    console.log("desc : " + description);
    console.log( " " + JSON.stringify(req.user));
    let result = db.query(
        'INSERT INTO event (name, categories, org_id, start_date, end_date, location, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [name, keywords, req.user.id, begin, end, venue, description],
        (err, results) => {
            if(err){
                throw err;
            }
            console.log(results.rows);
            //req.flash('success_msg','You are now registered and can log in');
            
        }
    )
    res.render("create-event.ejs");
})

app.post("/register-event", checkNotAuthenticated, async (req, res) => {
    const event_id = req.query.id;
    const org_id = await db.query("SELECT * FROM event WHERE id = $1", [event_id]);
    let result = await db.query("INSERT INTO registration (org_id, event_id, student_id) VALUES ($1, $2, $3)", [org_id.rows[0].org_id, event_id, req.user.id]);
    
    let post = await db.query('SELECT * FROM event WHERE id = $1', [req.query.id]);
    res.render("see-event.ejs", {event : post.rows[0], registered: true});
})

app.get("/logout", checkNotAuthenticated,  (req, res) => {
    req.logOut((err) => {
        if(err){
            console.error(err);
            res.redirect("/home");
        }
    });
    passport.initialize()(req, res, () => {
        // Redirect to the homepage
        res.redirect("/");
    });
    
})

function checkAuthenticated(req, res, next){
  if(req.isAuthenticated()){
      return res.redirect("/home");
  }
  next();
}

function checkNotAuthenticated(req, res, next){
  if(req.isAuthenticated()){
      return next();
  }
  res.redirect("/");
}

function isStudent(req, res, next) {
    if (req.isAuthenticated() && req.user.user_type === 'student') {
      return next();
    }
    res.redirect('/home');
}

function isOrganisation(req, res, next) {
    if (req.isAuthenticated() && req.user.user_type === 'organisation') {
        console.log("True for organisation");
        return next();
    }
    res.redirect('/home');
}

app.listen(PORT, ()=>{
    console.log("Server running on port 3000.")
})
