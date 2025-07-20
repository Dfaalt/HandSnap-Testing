import React from "react";
import Header from "./components/Header";
import HandRecognition from "./components/HandRecognition";
import Footer from "./components/Footer";
import { ToastContainer } from "react-toastify";

const App = () => {
  return (
    <div className="App">
      <Header />
      <HandRecognition />
      <Footer />
      <ToastContainer theme="dark" />
    </div>
  );
};

export default App;
