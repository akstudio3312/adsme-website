
document.addEventListener("DOMContentLoaded", () => {
  console.log("Welcome to AdsMe!");

  // Smooth scrolling for links to sections
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));

      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
});
