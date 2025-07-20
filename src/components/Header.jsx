import React from "react";

const Header = () => {
  return (
    <header className="bg-dark py-3 shadow-sm mb-2">
      <div className="container d-flex flex-column justify-content-center align-items-center text-center">
        <h1 className="text-success h4 m-0">Hand Snap</h1>
        <small className="fst-italic mt-2">
          Sistem transfer file menggunakan pengenalan gestur tangan berbasis AI
        </small>
      </div>
    </header>
  );
};

export default Header;
