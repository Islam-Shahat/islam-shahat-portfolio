const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../server/config/db');
const Project = require('../server/models/Project');

const targetProjects = [
  {
    title: "Veranda Café",
    category: "Frontend",
    subtitle: "Modern Café & Restaurant Platform",
    description: "A fully responsive front-end website for Veranda café, featuring a modern UI with interactive menu sections, smooth navigation, and contact information.",
    coverImage: "https://res.cloudinary.com/hbvtxcvd/image/upload/v1791922937/portfolio/image/z4k9aoux2pdf0tm77klo.jpg",
    image: "https://res.cloudinary.com/hbvtxcvd/image/upload/v1791922937/portfolio/image/z4k9aoux2pdf0tm77klo.jpg",
    gallery: [
      "https://res.cloudinary.com/hbvtxcvd/image/upload/v1791922937/portfolio/image/z4k9aoux2pdf0tm77klo.jpg",
      "assets/img/veranda.webp"
    ],
    images: [
      "https://res.cloudinary.com/hbvtxcvd/image/upload/v1791922937/portfolio/image/z4k9aoux2pdf0tm77klo.jpg",
      "assets/img/veranda.webp"
    ],
    date: "2026",
    demo: "https://veranda-cafe.vercel.app/",
    github: "https://github.com/Islam-Shahat/veranda-cafe-v2",
    technologies: ["HTML5", "CSS3", "JavaScript", "Responsive UI"],
    isFeatured: true,
    status: "published",
    orderIndex: 1
  },
  {
    title: "Aqario Luxe Real Estate",
    category: "MERN Stack",
    subtitle: "Real Estate Showcase & Property Platform",
    description: "A modern full-stack real estate web application featuring interactive property listings, advanced multi-criteria search filtering, client inquiries, and admin property management.",
    coverImage: "assets/img/aqario.webp",
    image: "assets/img/aqario.webp",
    gallery: [
      "assets/img/aqario.webp",
      "assets/img/RWD.webp"
    ],
    images: [
      "assets/img/aqario.webp",
      "assets/img/RWD.webp"
    ],
    date: "2026",
    demo: "",
    github: "https://github.com/islam-shahat",
    technologies: ["React.js", "Node.js", "Express.js", "MongoDB", "JWT Auth", "RESTful APIs"],
    isFeatured: true,
    status: "published",
    orderIndex: 2
  },
  {
    title: "ATM Banking System",
    category: "C++ & Software",
    subtitle: "Console Banking Simulation Architecture",
    description: "A console-based ATM simulation implementing core banking operations: deposit, withdrawal, balance inquiry, transaction history, and PIN security with clean OOP architecture and data structures.",
    coverImage: "assets/img/atm_system.webp",
    image: "assets/img/atm_system.webp",
    gallery: [
      "assets/img/atm_system.webp"
    ],
    images: [
      "assets/img/atm_system.webp"
    ],
    date: "2026",
    demo: "",
    github: "https://github.com/islam-shahat",
    technologies: ["C++", "OOP", "Data Structures", "Algorithms", "File Systems"],
    isFeatured: true,
    status: "published",
    orderIndex: 3
  },
  {
    title: "Scalable RESTful Backend Architecture",
    category: "Backend",
    subtitle: "High-Performance Express & MongoDB API Core",
    description: "Engineered high-performance RESTful API micro-services with secure JWT authentication, input validation, role-based controls (RBAC), rate limiting, and structured MongoDB modeling.",
    coverImage: "assets/img/backend_api.webp",
    image: "assets/img/backend_api.webp",
    gallery: [
      "assets/img/backend_api.webp",
      "assets/img/aqario.webp",
      "assets/img/RWD.webp"
    ],
    images: [
      "assets/img/backend_api.webp",
      "assets/img/aqario.webp",
      "assets/img/RWD.webp"
    ],
    date: "2026",
    demo: "",
    github: "https://github.com/islam-shahat",
    technologies: ["Node.js", "Express.js", "MongoDB", "JWT Security", "REST APIs", "Cloudinary"],
    isFeatured: true,
    status: "published",
    orderIndex: 4
  }
];

async function sync() {
  console.log('Connecting to database...');
  await connectDB();

  const finalProjects = [];

  for (const item of targetProjects) {
    let existing = await Project.findOne({ title: item.title });
    if (existing) {
      Object.assign(existing, item);
      await existing.save();
      console.log(`Updated project in DB: ${item.title}`);
      finalProjects.push(existing.toObject());
    } else {
      const created = await Project.create(item);
      console.log(`Created project in DB: ${item.title}`);
      finalProjects.push(created.toObject());
    }
  }

  // Also sync client/assets/data/projects.json
  const jsonPath = path.join(__dirname, '../client/assets/data/projects.json');
  fs.writeFileSync(jsonPath, JSON.stringify(finalProjects, null, 4), 'utf8');
  console.log(`Saved ${finalProjects.length} projects to ${jsonPath}`);

  process.exit(0);
}

sync().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
