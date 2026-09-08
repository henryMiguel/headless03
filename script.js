const WIKI_URL = "https://frictiondesign.fba.up.pt/mediawiki/api.php";
const BASE_URL = "https://frictiondesign.fba.up.pt";

// 1. Decide what to show based on the URL (SPA behavior)
const urlParams = new URLSearchParams(window.location.search);
const PAGE_NAME = urlParams.get("page");
const siteHeader = document.querySelector(".site-header");

if (PAGE_NAME) {
  // URL has "?page=X", hide table, show article
  if (siteHeader) 
  document.body.classList.add("is-article");
  document.getElementById("home-view").style.display = "none";
  document.getElementById("article-view").style.display = "block";
  fetchArticle(PAGE_NAME);
} else {
  // No page in URL, show the home page table
  if (siteHeader) siteHeader.style.display = "flex";
  document.body.classList.remove("is-article");
  document.getElementById("home-view").style.display = "grid";
  document.getElementById("article-view").style.display = "none";
  fetchPatternList();
}

// 2. FETCH THE LIST OF PATTERNS
async function fetchPatternList() {
  // Ask Wiki for all pages inside "Category:Pattern"
  const params = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: "Category:Pattern",
    cmlimit: 100, // Max number to fetch
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKI_URL}?${params}`);
    const data = await response.json();

    const pages = data.query.categorymembers;
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = ""; // Clear loading text

    if (pages.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3">No patterns found. Make sure pages are tagged with [[Category:Pattern]]</td></tr>`;
      return;
    }

    // Build the table rows
    pages.forEach((page) => {
      const row = document.createElement("tr");
      // Column 1 is a link to the article view. Columns 2 & 3 are hardcoded "Pending" for now.
      row.innerHTML = `
                        <td><a href="index.html?page=${encodeURIComponent(page.title)}" class="pattern-link">${page.title}</a></td>
                        <td style="color: #999;">Pending...</td>
                        <td style="color: #999;">Pending...</td>
                    `;
      tbody.appendChild(row);
    });

    // call rhizome rendering function after table is populated
    renderRhizome(pages);
  } catch (error) {
    console.error("Error fetching pattern list:", error);
    document.getElementById("table-body").innerHTML =
      `<tr><td colspan="3">Failed to load patterns.</td></tr>`;
  }
}

// 3. FETCH A SPECIFIC ARTICLE
async function fetchArticle(title) {
  const params = new URLSearchParams({
    action: "parse",
    page: title,
    format: "json",
    origin: "*",
    disableeditsection: true,
    disablelimitreport: true
    // disabletoc: true,
  });

  try {
    const response = await fetch(`${WIKI_URL}?${params}`);
    const data = await response.json();

    if (data.error) {
      document.getElementById("content").innerHTML =
        `<p style="color:red">Error: ${data.error.info}</p>`;
      return;
    }

    document.getElementById("page-title").innerText = data.parse.title;

    // 1. THE FIX: Update the variable to target the new ID
    const contentDiv = document.getElementById("article-content");
    contentDiv.innerHTML = data.parse.text["*"];

    // FIND AND STYLE THE SUMMARY ---
    const paragraphs = contentDiv.querySelectorAll("p");
    for (let p of paragraphs) {
      if (p.textContent.trim().startsWith("Summary:")) {
        p.classList.add("wiki-summary");
      }
    }

    // 2. EXTRACT THE TABLE OF CONTENTS
    const tocElement = contentDiv.querySelector(".toc"); // Grabs TOC from the new text box
    const articleSidebar = document.getElementById("article-sidebar");

    // Clear any old TOC from a previous article
    articleSidebar.innerHTML = "";

    if (tocElement) {
      // Move it into the sidebar!
      articleSidebar.appendChild(tocElement);
    }
  

    // Fix Images
    contentDiv.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && src.startsWith("/")) img.setAttribute("src", BASE_URL + src);

      const srcset = img.getAttribute("srcset");
      if (srcset) {
        img.setAttribute(
          "srcset",
          srcset
            .split(",")
            .map((s) => {
              const [url, descriptor] = s.trim().split(" ");
              return `${BASE_URL + url} ${descriptor || ""}`;
            })
            .join(", "),
        );
      }
    });

    // Fix Links so they stay in the SPA Router
    contentDiv.querySelectorAll("a").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.includes("/mediawiki/index.php/")) {
        const linkTitle = href.split("/").pop();
        link.setAttribute("href", `index.html?page=${linkTitle}`);
      }
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    document.getElementById("content").innerText = "Failed to load content.";
  }
}

// --- VIEW TOGGLE LOGIC ---
const btnRhizome = document.getElementById("btn-rhizome");
const btnList = document.getElementById("btn-list");
const rhizomeCanvas = document.getElementById("rhizome-canvas");
const patternTable = document.getElementById("pattern-table");

btnList.addEventListener("click", () => {
  btnList.classList.add("blue-btn");
  btnList.classList.remove("active");
  btnRhizome.classList.add("active");
  btnRhizome.classList.remove("blue-btn");

  rhizomeCanvas.style.display = "none";
  document.getElementById("fit-button").style.display = "none";
  patternTable.style.display = "table";
});

btnRhizome.addEventListener("click", () => {
  btnRhizome.classList.add("blue-btn");
  btnRhizome.classList.remove("active");
  btnList.classList.add("active");
  btnList.classList.remove("blue-btn");

  patternTable.style.display = "none";
  rhizomeCanvas.style.display = "block";
  document.getElementById("fit-button").style.display = "block";
});

// --- D3 RHIZOME GRAPH LOGIC ---
function renderRhizome(pages) {
  // 1. Setup the data Fake for now
  const nodes = pages
    .filter((p) => p.title !== "Main_Page")
    .map((p) => ({ id: p.title }));
  const links = [];

  // Create random connections to make it look like a web
  for (let i = 0; i < nodes.length; i++) {
    const targetIndex = Math.floor(Math.random() * nodes.length);
    if (i !== targetIndex) {
      links.push({ source: nodes[i].id, target: nodes[targetIndex].id });
    }
  }

  // 2. Clear out any old graph
  document.getElementById("rhizome-canvas").innerHTML = "";

  // 3. Setup the D3 SVG Canvas
  const width = 950;
  // const width = document.getElementById("rhizome-canvas").clientWidth;
  const height = 700;
  const svg = d3
    .select("#rhizome-canvas")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("cursor", "grab"); // Gives the user a hint they can drag the background

  // --- ZOOM ---
  // 3a. Create a "Master Group" that holds everything
  const mainGroup = svg.append("g");

  // 3b. Define the Zoom behavior (Min zoom 0.25x, Max zoom 4x)
  const zoom = d3
    .zoom()
    .scaleExtent([0.25, 4])
    .on("zoom", (event) => {
      // When the user scrolls or drags, apply the math to the Master Group
      mainGroup.attr("transform", event.transform);
    });

  // 3c. Turn on the zoom for the whole SVG canvas
  svg.call(zoom);
  // --------------------------

  // 4. Setup the Physics Engine
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d3) => d3.id)
        .distance(150),
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(40));

  // 5. Draw the lines (Links)
  const link = mainGroup
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "rhizome-link");

  // 6. Draw the text (Nodes)
  const node = mainGroup
    .append("g") // Group to hold all nodes
    .selectAll("foreignObject")
    .data(nodes)
    .join("foreignObject")
    .attr("width", 200) // node width
    .attr("height", 60) // node height
    .call(drag(simulation));

  // 6a. Put standard HTML in foreignObject
  node
    .append("xhtml:div")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("width", "100%")
    .style("height", "100%")
    .append("xhtml:span") // This is what we style in CSS!
    .attr("class", "node-text")
    .text((d) => d.id)
    .on("click", (event, d) => {
      window.location.href = `index.html?page=${encodeURIComponent(d.id)}`;
    });

  // 7. Make it move on every "tick" of the physics engine
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node
      .attr("x", (d) => d.x - 100) // Center text slightly
      .attr("y", (d) => d.y - 30); // Center text slightly
  });

  // --- FIT TO SCREEN BUTTON LOGIC ---
  const fitBtn = document.getElementById("fit-button");
  if (fitBtn) {
    // Remove old event listeners 
    const newBtn = fitBtn.cloneNode(true);
    fitBtn.parentNode.replaceChild(newBtn, fitBtn);

    newBtn.addEventListener("click", () => {
      // 1. Find the outer edges of graph
      const padding = 40; 
      const minX = d3.min(nodes, (d) => d.x) - 100 - padding; 
      const maxX = d3.max(nodes, (d) => d.x) + 100 + padding;
      const minY = d3.min(nodes, (d) => d.y) - 30 - padding; 
      const maxY = d3.max(nodes, (d) => d.y) + 30 + padding;

      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;

      // 2. Calculate zoom scale
      const scale = Math.min(width / graphWidth, height / graphHeight);

      // Clamp it so it doesn't zoom out further than your limit (0.25) or in too close (4)
      const clampedScale = Math.max(0.25, Math.min(scale, 4));

      // 3. Find the center point
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      const translateX = width / 2 - midX * clampedScale;
      const translateY = height / 2 - midY * clampedScale;

      // 4. animate the camera to the new coordinates
      svg
        .transition()
        .duration(750) // 750ms animation
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(translateX, translateY).scale(clampedScale),
        );
    });
  }

  // Physics Dragging functionality
  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
}


// --- P5.js Canvas Setup for Interactive Header ---

// 1. Declare flock globally so both setup() and draw() can use it
let flock;

function setup() {
  const container = document.getElementById("p5-canvas-container");
  let canvas = createCanvas(container.clientWidth, container.clientHeight);
  canvas.parent("p5-canvas-container");

  flock = new Flock();

  // Add an initial set of boids into the system
  for (let i = 0; i < 50; i++) {
    let b = new Boid(width / 2, height / 2);
    flock.addBoid(b);
  }

}

function draw() {
  clear();

  flock.run();
}

// 3. Move p5 events outside of draw()
function mouseMoved() {
  flock.addBoid(new Boid(mouseX, mouseY));
}

// Automatically resize the canvas if the user resizes their browser window
function windowResized() {
  const container = document.getElementById("p5-canvas-container");
  if (container) {
    resizeCanvas(container.clientWidth, container.clientHeight);
  }
}


class Flock {
  constructor() {
    this.boids = [];
  }

  run() {
    for (let boid of this.boids) {
      boid.run(this.boids);
    }
  }

  addBoid(b) {
    this.boids.push(b);
    const MAX_BOIDS = 150; //max number of boids
    if (this.boids.length > MAX_BOIDS) {
      this.boids.shift(); // Kills the oldest boid if there are too many
    }
  }
}

class Boid {
  constructor(x, y) {
    this.acceleration = createVector(0, 0);
    this.velocity = createVector(random(-1, 1), random(-1, 1));
    this.position = createVector(x, y);
    this.size = 3.0;
    this.maxSpeed = 3;
    this.maxForce = 0.05;
    colorMode(HSB);
    let myColors = ["#f1f1f1", "#109648", "#041B15"];
    this.color = color(random(myColors));
  }

  run(boids) {
    this.flock(boids);
    this.update();
    this.borders();
    this.render();
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  flock(boids) {
    let separation = this.separate(boids);
    let alignment = this.align(boids);
    let cohesion = this.cohesion(boids);

    separation.mult(1.5);
    alignment.mult(1.0);
    cohesion.mult(1.0);

    this.applyForce(separation);
    this.applyForce(alignment);
    this.applyForce(cohesion);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  seek(target) {
    let desired = p5.Vector.sub(target, this.position);
    desired.normalize();
    desired.mult(this.maxSpeed);
    let steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxForce);
    return steer;
  }

  render() {
    let theta = this.velocity.heading() + radians(90);
    fill(this.color);
    // stroke(255);
    noStroke();
    push();
    translate(this.position.x, this.position.y);
    rotate(theta);
    beginShape();
    vertex(0, -this.size * 2);
    vertex(-this.size, this.size * 2);
    vertex(this.size, this.size * 2);
    endShape(CLOSE);
    pop();
  }

  borders() {
    if (this.position.x < -this.size) this.position.x = width + this.size;
    if (this.position.y < -this.size) this.position.y = height + this.size;
    if (this.position.x > width + this.size) this.position.x = -this.size;
    if (this.position.y > height + this.size) this.position.y = -this.size;
  }

  separate(boids) {
    let desiredSeparation = 25.0;
    let steer = createVector(0, 0);
    let count = 0;
    for (let boid of boids) {
      let distanceToNeighbor = p5.Vector.dist(this.position, boid.position);
      if (distanceToNeighbor > 0 && distanceToNeighbor < desiredSeparation) {
        let diff = p5.Vector.sub(this.position, boid.position);
        diff.normalize();
        diff.div(distanceToNeighbor);
        steer.add(diff);
        count++;
      }
    }
    if (count > 0) steer.div(count);
    if (steer.mag() > 0) {
      steer.normalize();
      steer.mult(this.maxSpeed);
      steer.sub(this.velocity);
      steer.limit(this.maxForce);
    }
    return steer;
  }

  align(boids) {
    let neighborDistance = 50;
    let sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < boids.length; i++) {
      let d = p5.Vector.dist(this.position, boids[i].position);
      if (d > 0 && d < neighborDistance) {
        sum.add(boids[i].velocity);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxSpeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxForce);
      return steer;
    } else {
      return createVector(0, 0);
    }
  }

  cohesion(boids) {
    let neighborDistance = 50;
    let sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < boids.length; i++) {
      let d = p5.Vector.dist(this.position, boids[i].position);
      if (d > 0 && d < neighborDistance) {
        sum.add(boids[i].position);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    } else {
      return createVector(0, 0);
    }
  }
}