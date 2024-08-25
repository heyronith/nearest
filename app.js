let map, userMarker;
const API_KEY = 'QXIgL_7ONrkKaqjpw0Dfcr1jYIY3pjBmD2Tn4ayQ3CzbdOzN_rcAwmJK5OreGokONJDbn7DeVxqhFUNY_DbZYja8yZztFuHhypvxmF75df9AZvdgOrfPuYHmEyPLZnYx'; // Replace with your actual Yelp API key

function init() {
    document.getElementById('search-btn').addEventListener('click', searchPlaces);
    document.getElementById('location-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchPlaces();
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

function searchPlaces() {
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
                fetchYelpData(lat, lon, category);
            } else {
                alert("Location not found. Please try a different search term.");
            }
        })
        .catch(error => {
            console.error('Geocoding error:', error);
            alert("An error occurred while searching for the location. Please try again.");
        });
}

function fetchYelpData(lat, lon, category) {
    const url = `https://cors-anywhere.herokuapp.com/https://api.yelp.com/v3/businesses/search?latitude=${lat}&longitude=${lon}&categories=${category}&sort_by=distance&limit=3`;

    fetch(url, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        displayResults(data.businesses, {lat, lon});
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
        const marker = L.marker([place.coordinates.latitude, place.coordinates.longitude]).addTo(map)
            .bindPopup(`<strong>${place.name}</strong><br>Rating: ${place.rating}`);

        const placeElement = document.createElement('div');
        placeElement.className = 'result-item';
        placeElement.innerHTML = `
            <h3>${index + 1}. ${place.name}</h3>
            <div class="result-details">
                <p>Rating: ${place.rating} (${place.review_count} reviews)</p>
                <p>Distance: ${(place.distance / 1000).toFixed(2)} km</p>
                <p>Address: ${place.location.address1}, ${place.location.city}</p>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lon}&destination=${place.coordinates.latitude},${place.coordinates.longitude}" target="_blank" class="directions-link">
                    Get Directions
                </a>
            </div>
        `;

        placeElement.addEventListener('click', function() {
            this.classList.toggle('active');
            map.setView([place.coordinates.latitude, place.coordinates.longitude], 15);
            marker.openPopup();
        });

        resultsDiv.appendChild(placeElement);
    });
}

window.onload = init;
