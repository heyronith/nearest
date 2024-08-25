let map, userMarker;
const API_KEY = 'fsq3sZuimynM0NUYFhl4UBhd/YqEyOo4UB2NJtUyonpJqUU='; // Replace with your actual Foursquare API key

function init() {
    document.getElementById('nearest-btn').addEventListener('click', () => findPlaces(false));
    document.getElementById('nearest-rated-btn').addEventListener('click', () => findPlaces(true));
    document.getElementById('location-search').addEventListener('input', debounce(autocompleteLocation, 300));
    
    // Try to get user's location first
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            reverseGeocode(lat, lon);
            initMap(lat, lon);
        }, function(error) {
            console.error("Geolocation error:", error);
            alert("Unable to get your location. Please enter a location manually.");
        });
    } else {
        alert("Geolocation is not supported by this browser. Please enter a location manually.");
    }
}

function reverseGeocode(lat, lon) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`)
        .then(response => response.json())
        .then(data => {
            if (data.address && data.address.city) {
                document.getElementById('location-search').value = `${data.address.city}, ${data.address.state}, USA`;
            }
        })
        .catch(error => console.error('Reverse geocoding error:', error));
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

function autocompleteLocation() {
    const input = document.getElementById('location-search').value;
    if (input.length < 3) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&countrycodes=us&limit=5`)
        .then(response => response.json())
        .then(data => {
            const autocompleteResults = document.getElementById('autocomplete-results');
            autocompleteResults.innerHTML = '';
            data.forEach(result => {
                if (result.display_name.includes("United States")) {
                    const div = document.createElement('div');
                    div.textContent = result.display_name;
                    div.addEventListener('click', () => {
                        document.getElementById('location-search').value = result.display_name;
                        autocompleteResults.innerHTML = '';
                    });
                    autocompleteResults.appendChild(div);
                }
            });
        })
        .catch(error => console.error('Autocomplete error:', error));
}

function findPlaces(includeRating) {
    const location = document.getElementById('location-search').value;
    const category = document.getElementById('category').value;

    if (!location) {
        alert("Please enter a location to search.");
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&countrycodes=us&limit=1`)
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
    const url = `https://api.foursquare.com/v3/places/search?query=${category}&ll=${lat},${lon}&sort=DISTANCE&limit=15&fields=name,geocodes,rating,stats,distance`;

    console.log('Fetching from URL:', url);
    console.log('API Key used:', API_KEY.substring(0, 10) + '...');

    fetch(url, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'application/json'
        }
    })
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        return response.text();
    })
    .then(text => {
        console.log('Raw response:', text);
        const data = JSON.parse(text);
        if (data.message) {
            throw new Error(`API Error: ${data.message}`);
        }
        let places = data.results.map(place => ({
            name: place.name,
            lat: place.geocodes.main.latitude,
            lng: place.geocodes.main.longitude,
            rating: place.rating,
            reviewCount: place.stats ? place.stats.total_ratings : 'N/A',
            distance: place.distance / 1000 // Convert to km
        }));

        if (includeRating) {
            places = places.filter(place => place.rating !== undefined);
            places.sort((a, b) => (b.rating / b.distance) - (a.rating / a.distance));
        } else {
            places.sort((a, b) => a.distance - b.distance);
        }

        displayResults(places.slice(0, 3), {lat, lon});
    })
    .catch(error => {
        console.error('Error details:', error);
        alert('An error occurred while fetching places: ' + error.message);
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
                <p>Rating: ${place.rating ? place.rating.toFixed(1) : 'Not Available'} (${place.reviewCount} reviews)</p>
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

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function testFoursquareAPI() {
    const url = 'https://api.foursquare.com/v3/places/search?ll=40.7,-74&query=coffee&limit=1';

    fetch(url, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'application/json'
        }
    })
    .then(response => {
        console.log('Test Response status:', response.status);
        return response.text();
    })
    .then(text => {
        console.log('Test Raw response:', text);
    })
    .catch(error => {
        console.error('Test Error:', error);
    });
}

window.onload = function() {
    init();
    testFoursquareAPI();
};
