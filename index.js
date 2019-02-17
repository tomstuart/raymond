class Canvas {
  constructor(el) {
    this.el = el;
    this.width = el.width;
    this.height = el.height;

    this.ctx = el.getContext('2d');
    this.image = this.ctx.getImageData(0, 0, this.width, this.height);
  }

  drawPixel(x, y, color) {
    let i = (x + y * this.width) << 2;
    this.image.data[i] = color.red;
    this.image.data[++i] = color.green;
    this.image.data[++i] = color.blue;
    this.image.data[++i] = color.alpha;
  }

  render() {
    this.ctx.putImageData(this.image, 0, 0);
  }
}

class Minimap {
  constructor(el, zoom) {
    this.el = el;
    this.zoom = zoom;
    this.width = el.width;
    this.height = el.height;

    this.ctx = el.getContext('2d');
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.zoom, -this.zoom);
    this.ctx.lineWidth = 1 / this.zoom;
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  drawCamera(eye, film) {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(eye.x - 5 / this.zoom, eye.z - 5 / this.zoom, 10 / this.zoom, 10 / this.zoom);

    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = 'black';
    this.ctx.beginPath();
    this.ctx.moveTo(film.origin.x, film.origin.z);
    this.ctx.lineTo(film.origin.x + film.width, film.origin.z);
    this.ctx.stroke();

    const xDelta = film.origin.x - eye.x;
    const zDelta = film.origin.z - eye.z;
    const extent = 10;
    this.ctx.setLineDash([5 / this.zoom]);

    this.ctx.beginPath();
    this.ctx.moveTo(eye.x, eye.z);
    this.ctx.lineTo(film.origin.x + xDelta * extent, film.origin.z + zDelta * extent);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(eye.x, eye.z);
    this.ctx.lineTo(film.origin.x + film.width - xDelta * extent, film.origin.z + zDelta * extent);
    this.ctx.stroke();
  }

  drawSpheres(spheres) {
    spheres.sort((a, b) => a.center.y - b.center.y).forEach(sphere => {
      this.ctx.fillStyle = `rgba(${sphere.color.red}, ${sphere.color.green}, ${sphere.color.blue}, ${sphere.color.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(sphere.center.x, sphere.center.z, sphere.radius, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  drawLights(lights) {
    const size = 0.5;
    const lines = 10;

    lights.forEach(light => {
      this.ctx.fillStyle = 'orange';
      this.ctx.strokeStyle = 'orange';

      this.ctx.beginPath();
      this.ctx.arc(light.origin.x, light.origin.z, size, 0, 2 * Math.PI);
      this.ctx.fill();

      this.ctx.setLineDash([]);
      for (let line = 0; line < lines; line++) {
        let angle = line * (2 * Math.PI) / lines;
        this.ctx.beginPath();
        this.ctx.moveTo(light.origin.x + Math.cos(angle) * size * 1.2, light.origin.z + Math.sin(angle) * size * 1.2);
        this.ctx.lineTo(light.origin.x + Math.cos(angle) * size * 2, light.origin.z + Math.sin(angle) * size * 2);
        this.ctx.stroke();
      }
    });
  }
}

const sqr = n => n * n;
const clamp = (n, min, max) => n < min ? min : n > max ? max : n;

class Vec {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  get length() {
    return Math.sqrt(sqr(this.x) + sqr(this.y) + sqr(this.z));
  }

  unit() {
    const len = this.length;
    return new Vec(this.x / len, this.y / len, this.z / len);
  }

  add(other) {
    return new Vec(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other) {
    return new Vec(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(n) {
    return new Vec(this.x * n, this.y * n, this.z * n);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }
}

class RGB {
  static get black() {
    return new RGB(0, 0, 0);
  }

  static get red() {
    return new RGB(255, 0, 0);
  }

  static get green() {
    return new RGB(0, 255, 0);
  }

  static get blue() {
    return new RGB(0, 0, 255);
  }

  constructor(red, green, blue) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = 255;
  }

  shade(factor) {
    const f = clamp(factor, 0, 1);
    return new RGB(this.red * f, this.green * f, this.blue * f);
  }
}

class Sphere {
  constructor(center, radius, color) {
    this.center = center;
    this.radius = radius;
    this.color = color;
  }

  intersect(origin, line) {
    const oc = origin.subtract(this.center);
    const dot = line.dot(oc);
    const sqrtTerm = sqr(dot) - (sqr(oc.length) - sqr(this.radius));

    if (sqrtTerm < 0) {
      return [];
    } else if (sqrtTerm == 0) {
      return [-dot];
    }

    const sqrt = Math.sqrt(sqrtTerm);
    return [-dot + sqrt, -dot - sqrt];
  }
}

class Camera {
  constructor(eye, film) {
    this.eye = eye;
    this.film = film;
  }

  moveLeft() {
    this.eye.x--;
    this.film.origin.x--;
  }

  moveRight() {
    this.eye.x++;
    this.film.origin.x++;
  }

  moveUp() {
    this.eye.y++;
    this.film.origin.y++;
  }

  moveDown() {
    this.eye.y--;
    this.film.origin.y--;
  }

  moveForward() {
    this.eye.z++;
    this.film.origin.z++;
  }

  moveBack() {
    this.eye.z--;
    this.film.origin.z--;
  }
}

class Film {
  constructor(origin, width, height) {
    this.origin = origin;
    this.width = width;
    this.height = height;
  }

  project(offsetX, offsetY) {
    return new Vec(
      this.origin.x + this.width * offsetX,
      this.origin.y + this.height - (this.height * offsetY),
      this.origin.z,
    );
  }
}

const EPSILON = 1e-10;

class Light {
  constructor(origin, power) {
    this.origin = origin;
    this.power = power;
  }

  illuminate(point, surface, spheres) {
    const ray = this.origin.subtract(point);
    const direction = ray.unit();

    for (let sphere of spheres) {
      if (sphere.intersect(point, direction).some(t => t >= EPSILON)) {
        // If the shadow ray from the point to the light is occluded, this
        // light does not contribute any power to the colour of the point.
        return 0;
      }
    }

    const cosine = surface.dot(direction) / surface.length;
    return this.power * cosine / (4 * Math.PI * sqr(ray.length));
  }
}

(function() {
  const canvas = new Canvas(document.getElementById('canvas'));
  const minimap = new Minimap(document.getElementById('minimap'), 10);

  const eye = new Vec(3, 3, 0);
  const film = new Film(new Vec(0, 0, 3), 6, 6);
  const camera = new Camera(eye, film);

  const spheres = [
    new Sphere(new Vec(2, 6, 8), 1, RGB.green),
    new Sphere(new Vec(1, 6, 5), 1, RGB.blue),
    new Sphere(new Vec(3, 0, 12), 5, RGB.red),
  ];

  const lights = [
    new Light(new Vec(1, 8, 0), 300),
    new Light(new Vec(8, 5, 5), 300),
  ];

  render();

  function render() {
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const point = film.project(x / canvas.width, y / canvas.height);
        const direction = point.subtract(eye).unit();

        const nearest = spheres.reduce((min, sphere) => {
          const ts = sphere.intersect(eye, direction).sort((a, b) => a - b);

          for (let t of ts) {
            if (t >= EPSILON && t < min.t) {
              return { t, sphere };
            }
          }

          return min;
        }, { t: Infinity, sphere: null });

        const { t, sphere } = nearest;

        if (sphere) {
          const intersection = eye.add(direction.scale(t));
          const normal = intersection.subtract(sphere.center);

          const power = lights.reduce((acc, light) => (
            acc + light.illuminate(intersection, normal, spheres)
          ), 0);

          canvas.drawPixel(x, y, sphere.color.shade(power));
        } else {
          canvas.drawPixel(x, y, new RGB(180, 180, 180));
        }
      }
    }

    canvas.render();

    minimap.clear();
    minimap.drawCamera(eye, film);
    minimap.drawSpheres(spheres);
    minimap.drawLights(lights);
  }

  window.addEventListener('keyup', event => {
    switch (event.key) {
      case 'w':
        camera.moveForward();
        break;
      case 'W':
        eye.z++;
        break;
      case 'a':
      case 'ArrowLeft':
        camera.moveLeft();
        break;
      case 's':
        camera.moveBack();
        break;
      case 'S':
        eye.z--;
        break;
      case 'd':
      case 'ArrowRight':
        camera.moveRight();
        break;
      case 'ArrowUp':
        camera.moveUp();
        break;
      case 'ArrowDown':
        camera.moveDown();
        break;
      default:
        return;
    }

    render();
  });
})()
