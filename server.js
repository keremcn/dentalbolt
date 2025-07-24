const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./dental_cms.db');

// Initialize database tables
db.serialize(() => {
  // Users table for admin login
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'admin'
  )`);

  // Services table
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    price TEXT,
    duration TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Team members table
  db.run(`CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT,
    bio TEXT,
    image_url TEXT,
    specialties TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Practice info table
  db.run(`CREATE TABLE IF NOT EXISTS practice_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    hours TEXT,
    about_text TEXT,
    mission_statement TEXT
  )`);

  // Appointments table
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    service TEXT,
    preferred_date TEXT,
    preferred_time TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default admin user
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run("INSERT OR IGNORE INTO users (username, password) VALUES ('admin', ?)", [defaultPassword]);

  // Insert default practice info
  db.run(`INSERT OR IGNORE INTO practice_info (id, practice_name, phone, email, address, hours, about_text, mission_statement) 
    VALUES (1, 'Bright Smile Dental', '(555) 123-4567', 'info@brightsmile.com', 
    '123 Main Street, Anytown, ST 12345', 
    'Mon-Fri: 8AM-6PM, Sat: 9AM-2PM, Sun: Closed',
    'Welcome to Bright Smile Dental, where your oral health is our top priority. Our experienced team provides comprehensive dental care in a comfortable, modern environment.',
    'To provide exceptional dental care that improves the health, function, and beauty of our patients\'' smiles while ensuring comfort and satisfaction.')`);

  // Insert default services
  const defaultServices = [
    ['General Dentistry', 'Comprehensive oral health care including cleanings, fillings, and preventive treatments.', 'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg', '$80-200', '60-90 min'],
    ['Cosmetic Dentistry', 'Enhance your smile with veneers, whitening, and aesthetic treatments.', 'https://images.pexels.com/photos/3779705/pexels-photo-3779705.jpeg', '$300-1500', '90-120 min'],
    ['Orthodontics', 'Straighten your teeth with modern braces and clear aligner treatments.', 'https://images.pexels.com/photos/6812540/pexels-photo-6812540.jpeg', '$2000-6000', 'Multiple visits'],
    ['Oral Surgery', 'Expert surgical procedures including extractions and implant placement.', 'https://images.pexels.com/photos/3845456/pexels-photo-3845456.jpeg', '$500-3000', '60-180 min']
  ];

  const stmt = db.prepare("INSERT OR IGNORE INTO services (title, description, image_url, price, duration) VALUES (?, ?, ?, ?, ?)");
  defaultServices.forEach(service => {
    stmt.run(service);
  });
  stmt.finalize();

  // Insert default team members
  const defaultTeam = [
    ['Dr. Sarah Johnson', 'Lead Dentist & Practice Owner', 'Dr. Johnson has over 15 years of experience in comprehensive dental care. She graduated from University Dental School and specializes in cosmetic and restorative dentistry.', 'https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg', 'Cosmetic Dentistry, Restorative Care'],
    ['Dr. Michael Chen', 'Orthodontist', 'Dr. Chen specializes in orthodontic treatments and has helped hundreds of patients achieve their perfect smile through braces and clear aligners.', 'https://images.pexels.com/photos/5452268/pexels-photo-5452268.jpeg', 'Orthodontics, Clear Aligners'],
    ['Lisa Rodriguez', 'Dental Hygienist', 'Lisa is our experienced dental hygienist who ensures every patient receives thorough cleanings and personalized oral health education.', 'https://images.pexels.com/photos/5214997/pexels-photo-5214997.jpeg', 'Preventive Care, Patient Education']
  ];

  const teamStmt = db.prepare("INSERT OR IGNORE INTO team_members (name, title, bio, image_url, specialties) VALUES (?, ?, ?, ?, ?)");
  defaultTeam.forEach(member => {
    teamStmt.run(member);
  });
  teamStmt.finalize();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'dental-cms-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', 'layout');

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Create uploads directory
if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// Routes
// Public routes
app.get('/', (req, res) => {
  db.get("SELECT * FROM practice_info WHERE id = 1", (err, practiceInfo) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    
    db.all("SELECT * FROM services LIMIT 4", (err, services) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      
      res.render('index', { 
        title: 'Home',
        practiceInfo: practiceInfo || {}, 
        services: services || [],
        currentPage: 'home'
      });
    });
  });
});

app.get('/services', (req, res) => {
  db.all("SELECT * FROM services", (err, services) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    
    db.get("SELECT * FROM practice_info WHERE id = 1", (err, practiceInfo) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      
      res.render('services', { 
        title: 'Services',
        services: services || [],
        practiceInfo: practiceInfo || {},
        currentPage: 'services'
      });
    });
  });
});

app.get('/about', (req, res) => {
  db.get("SELECT * FROM practice_info WHERE id = 1", (err, practiceInfo) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    
    db.all("SELECT * FROM team_members", (err, teamMembers) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      
      res.render('about', { 
        title: 'About Us',
        practiceInfo: practiceInfo || {},
        teamMembers: teamMembers || [],
        currentPage: 'about'
      });
    });
  });
});

app.get('/contact', (req, res) => {
  db.get("SELECT * FROM practice_info WHERE id = 1", (err, practiceInfo) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    
    res.render('contact', { 
      title: 'Contact Us',
      practiceInfo: practiceInfo || {},
      currentPage: 'contact'
    });
  });
});

app.post('/contact', (req, res) => {
  const { patient_name, email, phone, service, preferred_date, preferred_time, message } = req.body;
  
  db.run(
    "INSERT INTO appointments (patient_name, email, phone, service, preferred_date, preferred_time, message) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [patient_name, email, phone, service, preferred_date, preferred_time, message],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      res.render('contact-success', { title: 'Appointment Requested', currentPage: 'contact' });
    }
  );
});

// Admin routes
app.get('/admin/login', (req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/admin');
    } else {
      res.render('admin/login', { error: 'Invalid username or password' });
    }
  });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin', requireAuth, (req, res) => {
  // Get counts for dashboard
  db.get("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'", (err, appointments) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    
    db.get("SELECT COUNT(*) as count FROM services", (err, services) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      
      db.get("SELECT COUNT(*) as count FROM team_members", (err, team) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Server error');
        }
        
        res.locals.layout = 'admin/layout';
        res.render('admin/dashboard', {
          appointmentCount: appointments.count,
          serviceCount: services.count,
          teamCount: team.count,
          currentPage: 'dashboard'
        });
      });
    });
  });
});

// Services management
app.get('/admin/services', requireAuth, (req, res) => {
  db.all("SELECT * FROM services ORDER BY created_at DESC", (err, services) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.locals.layout = 'admin/layout';
    res.render('admin/services', { services: services || [], currentPage: 'services' });
  });
});

app.get('/admin/services/add', requireAuth, (req, res) => {
  res.locals.layout = 'admin/layout';
  res.render('admin/service-form', { service: null, currentPage: 'services' });
});

app.get('/admin/services/edit/:id', requireAuth, (req, res) => {
  db.get("SELECT * FROM services WHERE id = ?", [req.params.id], (err, service) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.locals.layout = 'admin/layout';
    res.render('admin/service-form', { service: service, currentPage: 'services' });
  });
});

app.post('/admin/services', requireAuth, upload.single('image'), (req, res) => {
  const { title, description, price, duration } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image || '';
  
  if (req.body.id) {
    // Update existing service
    db.run(
      "UPDATE services SET title = ?, description = ?, image_url = ?, price = ?, duration = ? WHERE id = ?",
      [title, description, image_url, price, duration, req.body.id],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Server error');
        }
        res.redirect('/admin/services');
      }
    );
  } else {
    // Create new service
    db.run(
      "INSERT INTO services (title, description, image_url, price, duration) VALUES (?, ?, ?, ?, ?)",
      [title, description, image_url, price, duration],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Server error');
        }
        res.redirect('/admin/services');
      }
    );
  }
});

app.post('/admin/services/delete/:id', requireAuth, (req, res) => {
  db.run("DELETE FROM services WHERE id = ?", [req.params.id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.redirect('/admin/services');
  });
});

// Team management
app.get('/admin/team', requireAuth, (req, res) => {
  db.all("SELECT * FROM team_members ORDER BY created_at DESC", (err, teamMembers) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.locals.layout = 'admin/layout';
    res.render('admin/team', { teamMembers: teamMembers || [], currentPage: 'team' });
  });
});

app.get('/admin/team/add', requireAuth, (req, res) => {
  res.locals.layout = 'admin/layout';
  res.render('admin/team-form', { member: null, currentPage: 'team' });
});

app.get('/admin/team/edit/:id', requireAuth, (req, res) => {
  db.get("SELECT * FROM team_members WHERE id = ?", [req.params.id], (err, member) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.locals.layout = 'admin/layout';
    res.render('admin/team-form', { member: member, currentPage: 'team' });
  });
});

app.post('/admin/team', requireAuth, upload.single('image'), (req, res) => {
  const { name, title, bio, specialties } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image || '';
  
  if (req.body.id) {
    // Update existing team member
    db.run(
      "UPDATE team_members SET name = ?, title = ?, bio = ?, image_url = ?, specialties = ? WHERE id = ?",
      [name, title, bio, image_url, specialties, req.body.id],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Server error');
        }
        res.redirect('/admin/team');
      }
    );
  } else {
    // Create new team member
    db.run(
      "INSERT INTO team_members (name, title, bio, image_url, specialties) VALUES (?, ?, ?, ?, ?)",
      [name, title, bio, image_url, specialties],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Server error');
        }
        res.redirect('/admin/team');
      }
    );
  }
});

app.post('/admin/team/delete/:id', requireAuth, (req, res) => {
  db.run("DELETE FROM team_members WHERE id = ?", [req.params.id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.redirect('/admin/team');
  });
});

// Practice info management
app.get('/admin/practice', requireAuth, (req, res) => {
  db.get("SELECT * FROM practice_info WHERE id = 1", (err, practiceInfo) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.locals.layout = 'admin/layout';
    res.render('admin/practice', { practiceInfo: practiceInfo || {}, currentPage: 'practice' });
  });
});

app.post('/admin/practice', requireAuth, (req, res) => {
  const { practice_name, phone, email, address, hours, about_text, mission_statement } = req.body;
  
  db.run(
    "UPDATE practice_info SET practice_name = ?, phone = ?, email = ?, address = ?, hours = ?, about_text = ?, mission_statement = ? WHERE id = 1",
    [practice_name, phone, email, address, hours, about_text, mission_statement],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      res.redirect('/admin/practice');
    }
  );
});

// Appointments management
app.get('/admin/appointments', requireAuth, (req, res) => {
  db.all("SELECT * FROM appointments ORDER BY created_at DESC", (err, appointments) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.locals.layout = 'admin/layout';
    res.render('admin/appointments', { appointments: appointments || [], currentPage: 'appointments' });
  });
});

app.post('/admin/appointments/status/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  db.run("UPDATE appointments SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.redirect('/admin/appointments');
  });
});

app.listen(PORT, () => {
  console.log(`Dental CMS server running on port ${PORT}`);
  console.log(`Admin login: username: admin, password: admin123`);
});