import React from "react";

const Footer = () => {
  return (
    <footer className="bg-dark py-3 mt-2">
      <div className="container text-center text-white-50">
        <div>
          &copy; {new Date().getFullYear()} Hand Snap By Dfaalt. Just snap your
          hand, transfer like magic. ✨
        </div>
        <div className="mt-2">
          <a
            href="https://github.com/dfaalt"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-hover mx-2"
          >
            <i className="bi bi-github fs-4"></i>
          </a>
          <a
            href="https://www.linkedin.com/in/ilham-maulana1101"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-hover mx-2"
          >
            <i className="bi bi-linkedin fs-4"></i>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
