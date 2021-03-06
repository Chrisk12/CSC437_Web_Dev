var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');
var mysql = require('mysql');

router.baseURL = '/Prss';

/*
*/
router.get('/', function(req, res) {
   var email = req.session.isAdmin() && req.query.email ||
    !req.session.isAdmin() && req.session.email;
   var cnnConfig = {
      host     : 'localhost',
      user     : 'ChatSite',
      password : 'Chat5ite!',
      database : 'ckim65'
   };

   req.cnn.release();  // Since we're not using that

   var cnn = mysql.createConnection(cnnConfig);

   if (email)
      cnn.query('select id, email from Person where email = ?', [email],
      function(err, result) {
         if (err) {
            cnn.destroy();
            res.status(500).json("Failed query");
         }
         else {
            res.status(200).json(result);
         }
      });
   else
      cnn.query('select id, email from Person',
      function(err, result) {
         if (err) {
            cnn.destroy();
            res.status(500).json("Failed query");
         }
         else {
            res.status(200).json(result);
         }
      });
});


// // Non-waterfall, non-validator, non-db automation version
// router.post('/', function(req, res) {
//    var body = req.body;
//    var admin = req.session && req.session.isAdmin();
//    var errorList = [];
//    var qry;
//    var noPerm;
//    var cnnConfig = {
//       host     : '127.0.0.1',
//       user     : 'cstaley',
//       password : 'secret',
//       database : 'CHSdb'
//    };

//    req.cnn.release();  // Since we're not using that

//    if (admin && !body.password)
//       body.password = "*";                       // Blocking password
//    body.whenRegistered = new Date();

//    // Check for fields
//    if (!body.hasOwnProperty('email'))
//       errorList.push({tag: "missingField", params: "email"});
//    if (!body.hasOwnProperty('password'))
//       errorList.push({tag: "missingField", params: "password"});
//    if (!body.hasOwnProperty('role'))
//       errorList.push({tag: "missingField", params: "role"});

//    // Do these checks only if all fields are there
//    if (!errorList.length) {
//       noPerm = body.role === 1 && !admin;
//       if (!body.termsAccepted)
//          errorList.push({tag: "noTerms"});
//       if (body.role < 0)
//          errorList.push({tag: "badVal", param: "role"});
//    }

//    // Post errors, or proceed with data fetches
//    if (noPerm)
//       res.status(403).end();
//    else if (errorList.length)
//       res.status(400).json(errorList);
//    else {
//       var cnn = mysql.createConnection(cnnConfig);

//       // Find duplicate Email if any.
//       cnn.query(qry = 'select * from Person where email = ?', body.email,
//       function(err, dupEmail) {
//          if (err) {
//             cnn.destroy();
//             res.status(500).json("Failed query " + qry);
//          }
//          else if (dupEmail.length) {
//             cnn.destroy();
//             res.status(400).json({tag: "dupEmail"});
//          }
//          else { // No duplicate, so make a new Person
//             body.termsAccepted = body.termsAccepted && new Date();
//             cnn.query(qry = 'insert into Person set ?', body,
//             function(err, insRes) {
//                cnn.destroy();
//                if (err)
//                   res.status(500).json("Failed query " + qry);
//                else
//                   res.location(router.baseURL + '/' + insRes.insertId).end();
//             });
//           }
//       });
//    }
// });


router.get('/', function(req, res) {
   var email = req.session.isAdmin() && req.query.email ||
    !req.session.isAdmin() && req.session.email;

   var handler = function(err, prsArr) {
      res.json(prsArr);
      req.cnn.release();
   };

   if (email)
      req.cnn.chkQry('select id, email from Person where email = ?', [email],
       handler);
   else
      req.cnn.chkQry('select id, email from Person', handler);
});

router.post('/', function(req, res) {
   var vld = req.validator;  // Shorthands
   var body = req.body;
   var admin = req.session && req.session.isAdmin();
   var cnn = req.cnn;

   if (admin && !body.password)
      body.password = "*";                       // Blocking password
   body.whenRegistered = new Date();

   async.waterfall([
   function(cb) { // Check properties and search for Email duplicates
      if (vld.hasFields(body, ["email", "lastName", "password", "role"], cb) &&
       vld.chain(body.role === 0 || admin, Tags.noPermission)
       .chain(body.termsAccepted || admin, Tags.noTerms)
       .chain(body.password || admin, Tags.missingField)
       .chain(body.email, Tags.missingField)
       .chain(body.lastName, Tags.missingField)
       .check(body.role >= 0, Tags.badValue, ["role"], cb)) {
         cnn.chkQry('select * from Person where email = ?', body.email, cb);
      }
   },
   function(existingPrss, fields, cb) {  // If no duplicates, insert new Person
      if (vld.check(!existingPrss.length, Tags.dupEmail, null, cb)) {
         body.termsAccepted = body.termsAccepted && new Date();
         cnn.chkQry('insert into Person set ?', body, cb);
      }
   },
   function(result, fields, cb) { // Return location of inserted Person
      res.location(router.baseURL + '/' + result.insertId).end();
      cb();
   }],
   function() {
      cnn.release();
   });
});


// router.get('/:id', function(req, res) {
//    var vld = req.validator;

//    if (vld.checkPrsOK(req.params.id)) {
//       req.cnn.query('select * from Person where id = ?', [req.params.id],
//       function(err, prsArr) {
//          if (vld.check(prsArr.length, Tags.notFound))
//             res.json(prsArr);
//          req.cnn.release();
//       });
//    }
//    else {
//       req.cnn.release();
//    }
// });

router.get("/:id", function(req, res) {
   var vld = req.validator;  // Shorthands
   async.waterfall([
   function(cb) {
      if (vld.checkPrsOK(req.params.id, cb)) {
         req.cnn.chkQry('select * from Person where id = ?', [req.params.id], cb);
      }
   },
   function(prsArr, fields, cb) {
      if (vld.check(prsArr.length, Tags.notFound, null, cb))
         res.json(prsArr);
         cb();   
   }],
   function(err) {
      req.cnn.release();
   });
});

router.put("/:id", function(req, res) {

   var vld = req.validator;
   var body = req.body 
   var admin = req.session && req.session.isAdmin();
   var cnn = req.cnn

   async.waterfall([

      function (cb) {

         if (vld.checkPrsOK(req.params.id, cb) &&
            vld.chain(!body.termsAccepted, Tags.forbiddenField, ["termsAccepted"])
            .chain(!body.whenRegistered, Tags,forbiddenField, ["whenRegistered"])
            .chain(!("password" in body) || body.password, Tags.badValue, ["password"])
            .chain(!("password" in body) || "oldPassword" in body || admin, Tags.noOldPwd, ["password"])
            .check(!body.role || admin, Tags.badValue, ["role"], cb)) {         

            cnn.chkQry('select * from Person where id = ?', [req.params.id], cb);
         }

      },
      function(result, fields, cb) {



         if(vld.check(result.length, Tags.notFound, null, cb) &&
            chain(!("password" in body) || body.oldPassword === result[0].password || admin, Tags.oldPwdMismatch)) {

            delete body.oldPassword
            cnn.chkQry('update Person set ? where id = ?', [body,req.params.id], cb);
         }

      }, 
      function(result, fields, cb) {

         res.status.end();
         cb();

      }],
      function(err){
         cnn.release();
      }
   )

});

router.delete('/:id', function(req, res) {
   var vld = req.validator;

   if (vld.checkAdmin())
      req.cnn.query('DELETE from Person where id = ?', [req.params.id],
      function (err, result) {
         if (!err || vld.check(result.affectedRows, Tags.notFound))
            res.status(200).end();
         req.cnn.release();
      });
   else {
      req.cnn.release();
   }
});

module.exports = router;
