const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const bcrypt = require('bcrypt');
const saltRound = 10;

const jwt = require('jsonwebtoken');

app.use(cookieParser());

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use (
    session ({
        key: "userId",
        secret: "subscribe",
        resave: false,
        saveUninitialized: false,
        cookie: {
            expires: 60 * 60 * 24,
        },
    })
);


const db = mysql.createPool({
    host: "127.0.0.1",
    user: "organize",
    password: "organizer1!",
    database: "organizatoriai",
});

 
const verifyJWT = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const authorized = false;
        const decoded = jwt.verify(
          token,
          'SECRETKEY'
        );
        req.userData = decoded;

        const sqlGet = "SELECT role FROM User where id = ? and role = ?";

        db.query(sqlGet,decoded.userId, role, (error, result) => {
            if(error) {
                console.log(error);
            }
            authorized=true;
        })    

        if (authorized) {
            return res.status(403).send({
                msg: 'Endpoint is only accessible by: Admin'
            });
        }

        next();
      } catch (err) {
        return res.status(401).send({
          msg: 'Your session is not valid!'
        });
      }
};

const Role = require('./role.js');

app.get("/api/getAttenders", verifyJWT.role="Admin", ( req, res) => {
    const sqlGet = "SELECT * FROM Attender";

    db.query(sqlGet, (error, result) => {
        res.send(result);
    })
})

app.get("/api/get/:id", (req, res) => {
    const { id } = req.params;

    const sqlGet = "SELECT * FROM Attender WHERE id = ?";

    db.query(sqlGet,id, (error, result) => {
        if(error) {
            console.log(error);
        }
        res.send(result);
    })
})

app.put("/api/update/:id", (req, res) => {
    const { id } = req.params;
    const { namesurname, email, age } = req.body;
    const sqlPut = "UPDATE Attender SET namesurname = ?, email = ?, age = ? WHERE id = ?";

    db.query(sqlPut, [namesurname, email, age, id], (error, result) => {
        if(error) {
            console.log(error);
        }
        res.send(result);
    });
})

app.post("/api/addAttender", (req, res) => {
    const { namesurname, email, age } = req.body;
    const sqlInsert = 
    "INSERT INTO Attender (namesurname, email, age) VALUES (?, ?, ?)";
    db.query(sqlInsert, [namesurname, email, age], (error, result) => {
        if (error) {
            console.log(error);
        }
    });
});

app.delete("/api/remove/:id", (req, res) => {
    const { id } = req.params;
    const sqlDelete = 
    "DELETE FROM Attender where id = ?";
    db.query(sqlDelete, id, (error, result) => {
        if (error) {
            console.log(error);
        }
    });
});

const validateRegister = (req, res, next) => {
    // username min length 3
    if (!req.body.username || req.body.username.length < 3) {
      return res.status(400).send({
        msg: 'Please enter a username with min. 3 chars'
      });
    }
    // password min 6 chars
    if (!req.body.password || req.body.password.length < 6) {
      return res.status(400).send({
        msg: 'Please enter a password with min. 6 chars'
      });
    }
    // password (repeat) does not match
    if (
      !req.body.password_repeat ||
      req.body.password != req.body.password_repeat
    ) {
      return res.status(400).send({
        msg: 'Both passwords must match'
      });
    }
    next();
}


app.post('/api/register', validateRegister, (req, res, next)=> {
    db.query(
        `SELECT * FROM User WHERE LOWER(username) = LOWER(${db.escape(
          req.body.username
        )});`,
        (err, result) => {
          if (result.length) {
            return res.status(409).send({
              msg: 'This username is already in use!'
            });
          } else {
            // username is available
            bcrypt.hash(req.body.password, 10, (err, hash) => {
              if (err) {
                return res.status(500).send({
                  msg: err
                });
              } else {
                // has hashed pw => add to database
                db.query(
                  `INSERT INTO User (username, password, registered) VALUES ( ${db.escape(
                    req.body.username
                  )}, ${db.escape(hash)}, now())`,
                  (err, result) => {
                    if (err) {
                      throw err;
                      return res.status(400).send({
                        msg: err
                      });
                    }
                    return res.status(201).send({
                      msg: 'Registered!'
                    });
                  }
                );
              }
            });
          }
        }
      );
});

app.get('/isUserAuth', verifyJWT , (req, res) => {
    res.send("You are authenticated Congrats:")
})

app.post('/login', (req, res) => {
    db.query(
        `SELECT * FROM User WHERE username = ${db.escape(req.body.username)};`,
        (err, result) => {
          // user does not exists
          if (err) {
            throw err;
            return res.status(400).send({
              msg: err
            });
          }
          if (!result.length) {
            return res.status(401).send({
              msg: 'Username or password is incorrect!'
            });
          }
          // check password
          bcrypt.compare(
            req.body.password,
            result[0]['password'],
            (bErr, bResult) => {
              // wrong password
              if (bErr) {
                throw bErr;
                return res.status(401).send({
                  msg: 'Username or password is incorrect!'
                });
              }
              if (bResult) {
                const token = jwt.sign({
                    username: result[0].username,
                    userId: result[0].id
                  },
                  'SECRETKEY', {
                    expiresIn: '7d'
                  }
                );
                db.query(
                  `UPDATE User SET last_login = now() WHERE id = '${result[0].id}'`
                );
                return res.status(200).send({
                  msg: 'Logged in!',
                  token,
                  user: result[0]
                });
              }
              return res.status(401).send({
                msg: 'Username or password is incorrect!'
              });
            }
          );
        }
      );
});

app.get("/", (req, res) => {
    /*const sqlInsert = "INSERT INTO Attender (namesurname, email, age) VALUES ('asldkfa', 'alskjdfkjas@aaa.aaa', 22)";

    db.query(sqlInsert, (error, result) => {
        console.log("error", error);
        console.log("result", result);
        res.send("Hello Express");
    });)*/
});

app.listen(8083, () => 
console.log("Server is running on port 8083"));