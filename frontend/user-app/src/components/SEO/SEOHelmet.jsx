import React from "react";
import { Helmet } from "react-helmet";

const SEOHelmet = ({ title, description }) => {
  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
    </Helmet>
  );
};

export default SEOHelmet;
