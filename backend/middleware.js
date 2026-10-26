// middleware.js
function isAdmin(req, res, next){
  if(!req.session || !req.session.admin){
    return res.redirect('/index.html');
  }
  next();
}

module.exports = { isAdmin };
