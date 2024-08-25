let map, userMarker;
const API_KEY = 'fsq3sZuimynM0NUYFhl4UBhd/YqEyOo4UB2NJtUyonpJqUU='; // Replace with your actual Foursquare API key

function init() {
    document.getElementById('nearest-btn').addEventListener('click', () => findPlaces(false));
    document.getElementById('nearest-rated-btn').addEventListener('click', () => findPlaces(true));
    document.getElementById('location-search').addEventListener('input', debounce(autocompleteLocation, 300));
    document.getElementById('location-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            findPlaces(false);
        }
    });
}

function initMap(lat, lng) {
    if (!map) {
        map = L.map('map').setView([lat, lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    } else {
        map.setView([lat, lng], 13);
    }
    document.getElementById('map-container').style.height = '400px';
}

function findPlaces(includeRating) {
    const location = document.getElementById('location-search').value;
    const category = document.getElementById('category').value;

    if (!location) {
        alert("Please enter a location to search.");
        return;
    }

    // First, geocode the location
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const lat = data[0].lat;
                const lon = data[0].lon;
                initMap(lat, lon);
                fetchFoursquareData(lat, lon, category, includeRating);
            } else {
                alert("Location not found. Please try a different search term.");
            }
        })
        .catch(error => {
            console.error('Geocoding error:', error);
            alert("An error occurred while searching for the location. Please try again.");
        });
}

function fetchFoursquareData(lat, lon, category, includeRating) {
    const url = `https://api.foursquare.com/v3/places/search?query=${category}&ll=${lat},${lon}&sort=DISTANCE&limit=15`;

    fetch(url, {
        headers: {
            'Authorization': API_KEY
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        let places = data.results.map(place => ({
            name: place.name,
            lat: place.geocodes.main.latitude,
            lng: place.geocodes.main.longitude,
            rating: place.rating ? place.rating / 2 : null,
            distance: distance({lat, lng: lon}, {lat: place.geocodes.main.latitude, lng: place.geocodes.main.longitude})
        }));

        if (includeRating) {
            places = places.filter(place => place.rating !== null);
            places.sort((a, b) => (b.rating / b.distance) - (a.rating / a.distance));
        } else {
            places.sort((a, b) => a.distance - b.distance);
        }

        displayResults(places.slice(0, 3), {lat, lon});
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while fetching places. Please try again.');
    });
}

function displayResults(places, userLocation) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    map.eachLayer((layer) => {
        if(!(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    userMarker = L.marker([userLocation.lat, userLocation.lon]).addTo(map)
        .bindPopup('Your Location').openPopup();

    places.forEach((place, index) => {
        const marker = L.marker([place.lat, place.lng]).addTo(map)
            .bindPopup(`<strong>${place.name}</strong><br>Rating: ${place.rating ? place.rating.toFixed(1) : 'N/A'}`);

        const placeElement = document.createElement('div');
        placeElement.className = 'result-item';
        placeElement.innerHTML = `
            <h3>${index + 1}. ${place.name}</h3>
            <div class="result-details">
                <p>Rating: ${place.rating ? place.rating.toFixed(1) : 'Not Available'}</p>
                <p>Distance: ${place.distance.toFixed(2)} km</p>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lon}&destination=${place.lat},${place.lng}" target="_blank" class="directions-link">
                    Get Directions
                </a>
            </div>
        `;

        placeElement.addEventListener('click', function() {
            this.classList.toggle('active');
            map.setView([place.lat, place.lng], 15);
            marker.openPopup();
        });

        resultsDiv.appendChild(placeElement);
    });
}

function autocompleteLocation() {
    const input = document.getElementById('location-search').value;
    if (input.length < 3) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}`)
        .then(response => response.json())
        .then(data => {
            const results = data.slice(0, 5);
            const autocompleteResults = document.getElementById('autocomplete-results');
            autocompleteResults.innerHTML = '';
            results.forEach(result => {
                const div = document.createElement('div');
                div.textContent = result.display_name;
                div.addEventListener('click', () => {
                    document.getElementById('location-search').value = result.display_name;
                    autocompleteResults.innerHTML = '';
                });
                autocompleteResults.appendChild(div);
            });
        })
        .catch(error => console.error('Autocomplete error:', error));
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function distance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

window.onload = init;
