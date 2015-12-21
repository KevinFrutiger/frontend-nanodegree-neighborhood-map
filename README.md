# Neighborhood Map project

This was the fifth project in the Udacity Front-End Nanodegree. The objective was to build a application featuring a Google Map and a filtered list of places, utilizing the Knockout MVVM framework, the Google Maps API, and additional third-party APIs (i.e. AJAX requests).

## Running the Application

You can run the live application [here](https://kevinfrutiger.github.io/frontend-nanodegree-neighborhood-map/).

You can run the files locally by doing the following:

1. Download the .zip file using the **Download ZIP** button located in the GitHub sidebar (or clone the repository).
2. Unzip the file
3. To run the application, you must run the files through a web server. [http-server](https://www.npmjs.com/package/http-server) is a simple local server you can get via npm.
4. Point your browser to index.html in the **src** folder of the files that you just unzipped to run the non-minified files. Point your browser to index.html in the **deploy** folder to run the same files found on the live site.

## Using the Application

When the appliation loads, you'll see a Google Map with markers designating some pre-defined locations. You can click these markers to get additional information.

### Filter the map results

On the left side of the application is the filter menu. On smaller screens it's hidden behind the menu icon. Simple click/tap the icon to display the filter. The map displays markers for the places listed in this menu. You can filter the locations shown by entering text in the input field, and the list and markers will only display for those place names that match the text you've entered.