let map, userMarker;

// We'll load these from environment variables or a secure configuration in a real production setup
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoicm9uaXRoc2hhcm1pbGEiLCJhIjoiY20wYnN0OWp2MGFhdTJrcHhtMDlzYTBkeiJ9.0FB0MmTbjbT-KNOcqvZXgg';
const FOURSQUARE_API_KEY = 'fsq3hgre3kJzErOP5MM+wpqXqIKxguCtEElSVG2Rc0+jDK0=';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

function init() {
    document.getElementById('nearest-btn').addEventListener('click', findPlaces);
    document.getElementById('search-btn').addEventListener('click', searchLocation);
    initAutocomplete();
    addNearestScoreInfo();
}

function initMap(lng, lat) {
    if (!map) {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [lng, lat],
            zoom: 13
        });

        map.addControl(new mapboxgl.NavigationControl());

        userMarker = new mapboxgl.Marker()
            .setLngLat([lng, lat])
            .addTo(map);
    } else {
        map.setCenter([lng, lat]);
        userMarker.setLngLat([lng, lat]);
    }

    document.getElementById('map-container').style.height = '400px';
    map.resize();
}

function initAutocomplete() {
    const locationInput = document.getElementById('location-search');
    let timeout = null;

    locationInput.addEventListener('input', function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const query = this.value;
            if (query.length > 2) {
                fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=place,locality,neighborhood`)
                    .then(response => response.json())
                    .then(data => {
                        const suggestions = data.features.map(feature => feature.place_name);
                        showSuggestions(suggestions);
                    })
                    .catch(error => console.error('Error:', error));
            } else {
                clearSuggestions();
            }
        }, 300);
    });
}

function showSuggestions(suggestions) {
    const suggestionsList = document.getElementById('suggestions') || createSuggestionsList();
    suggestionsList.innerHTML = '';
    suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = suggestion;
        li.addEventListener('click', () => {
            document.getElementById('location-search').value = suggestion;
            clearSuggestions();
            searchLocation();
        });
        suggestionsList.appendChild(li);
    });
}

function createSuggestionsList() {
    const suggestionsList = document.createElement('ul');
    suggestionsList.id = 'suggestions';
    suggestionsList.style.cssText = 'list-style-type: none; padding: 0; margin: 0; position: absolute; background: white; border: 1px solid #ccc; width: calc(100% - 22px);';
    document.getElementById('location-search').parentNode.appendChild(suggestionsList);
    return suggestionsList;
}

function clearSuggestions() {
    const suggestionsList = document.getElementById('suggestions');
    if (suggestionsList) {
        suggestionsList.innerHTML = '';
    }
}

function addNearestScoreInfo() {
    const infoLink = document.createElement('a');
    infoLink.href = '#';
    infoLink.textContent = "What's Nearest Score?";
    infoLink.style.cssText = 'position: fixed; bottom: 10px; left: 10px; z-index: 1000;';
    
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
        <h3>About Nearest Score</h3>
        <p>The Nearest Score is a measure that combines the quality and popularity of a place. It takes into account:</p>
        <ul>
            <li>The place's rating</li>
            <li>The number of reviews</li>
        </ul>
        <p>A higher score indicates a better overall experience based on user ratings and popularity.</p>
    `;
    infoDiv.style.cssText = 'display: none; position: fixed; bottom: 40px; left: 10px; background: white; padding: 20px; border: 1px solid #ccc; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 300px; z-index: 1000;';
    
    infoLink.addEventListener('click', function(e) {
        e.preventDefault();
        infoDiv.style.display = infoDiv.style.display === 'none' ? 'block' : 'none';
    });
    
    document.body.appendChild(infoLink);
    document.body.appendChild(infoDiv);
}

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                position => resolve({lng: position.coords.longitude, lat: position.coords.latitude}),
                error => reject("Unable to get your location. Please enter a location manually.")
            );
        } else {
            reject("Geolocation is not supported by this browser. Please enter a location manually.");
        }
    });
}

function searchLocation() {
    const query = document.getElementById('location-search').value;
    if (!query) {
        alert("Please enter a location to search.");
        return;
    }

    showLoading();

    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}`)
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                updateMap(lng, lat, data.features[0].place_name);
            } else {
                throw new Error("Location not found. Please try a different search term.");
            }
        })
        .catch(handleError)
        .finally(hideLoading);
}

function updateMap(lng, lat, popupText) {
    initMap(lng, lat);
    new mapboxgl.Popup()
        .setLngLat([lng, lat])
        .setHTML(popupText)
        .addTo(map);
}

function findPlaces() {
    if (!userMarker) {
        getUserLocation()
            .then(coords => {
                updateMap(coords.lng, coords.lat, "Your Location");
                fetchPlaces(coords.lat, coords.lng);
            })
            .catch(handleError);
    } else {
        const {lng, lat} = userMarker.getLngLat();
        fetchPlaces(lat, lng);
    }
}

function calculateNearestScore(rating, reviews) {
    const ratingWeight = 0.7;
    const reviewsWeight = 0.3;

    const normalizedRating = rating / 10;
    const normalizedReviews = Math.min(reviews / 1000, 1);

    return (normalizedRating * ratingWeight + normalizedReviews * reviewsWeight) * 100;
}

function getDescriptiveScore(score) {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Very Good";
    if (score >= 40) return "Good";
    if (score >= 20) return "Fair";
    return "Average";
}

function fetchPlaces(lat, lng) {
    const category = document.getElementById('category').value;
    const url = `https://api.foursquare.com/v3/places/search?query=${category}&ll=${lat},${lng}&sort=DISTANCE&limit=50&fields=name,geocodes,rating,stats,distance,location`;

    showLoading();

    fetch(url, {
        headers: {
            'Authorization': FOURSQUARE_API_KEY
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.results || data.results.length === 0) {
            throw new Error('No results found');
        }

        let places = data.results.map(place => ({
            name: place.name,
            lng: place.geocodes.main.longitude,
            lat: place.geocodes.main.latitude,
            rating: place.rating || 0,
            reviews: place.stats?.total_ratings || 0,
            distance: place.distance,
            address: place.location.formatted_address,
            nearestScore: calculateNearestScore(place.rating || 0, place.stats?.total_ratings || 0)
        }));

        // Normalize distance and nearest score
        const maxDistance = Math.max(...places.map(p => p.distance));
        const maxScore = Math.max(...places.map(p => p.nearestScore));

        places.forEach(place => {
            place.normalizedDistance = 1 - (place.distance / maxDistance);
            place.normalizedScore = place.nearestScore / maxScore;
            place.combinedScore = (place.normalizedDistance + place.normalizedScore) / 2;
            place.descriptiveScore = getDescriptiveScore(place.nearestScore);
        });

        // Sort places by combined score
        places.sort((a, b) => b.combinedScore - a.combinedScore);

        displayResults(places.slice(0, 3), {lat, lng});
    })
    .catch(handleError)
    .finally(hideLoading);
}

function displayResults(places, userLocation) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    // Clear existing markers
    if (map.markers) {
        map.markers.forEach(marker => {
            if (marker !== userMarker) {
                marker.remove();
            }
        });
    }
    map.markers = [userMarker];

    places.forEach((place, index) => {
        const marker = new mapboxgl.Marker()
            .setLngLat([place.lng, place.lat])
            .addTo(map);

        map.markers.push(marker);

        const popup = new mapboxgl.Popup({offset: 25})
            .setHTML(`<strong>${place.name}</strong><br>Rating: ${place.rating.toFixed(1)} (${place.reviews} reviews)<br>Nearest Score: ${place.descriptiveScore}`);

        marker.setPopup(popup);

        const placeElement = document.createElement('div');
        placeElement.className = 'result-item';
        placeElement.innerHTML = `
            <h3>${index + 1}. ${place.name}</h3>
            <div class="result-details">
                <p>Rating: ${place.rating.toFixed(1)} (${place.reviews} reviews)</p>
                <p>Nearest Score: <span class="nearest-score">${place.descriptiveScore} (${place.nearestScore.toFixed(2)})</span></p>
                <p>Distance: ${(place.distance / 1000).toFixed(2)} km</p>
                <p>Address: ${place.address}</p>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${place.lat},${place.lng}" target="_blank" class="directions-link">
                    <i class="fas fa-directions"></i> Get Directions
                </a>
            </div>
        `;

        placeElement.addEventListener('click', function() {
            this.querySelector('.result-details').style.display = 
                this.querySelector('.result-details').style.display === 'none' ? 'block' : 'none';
            map.flyTo({center: [place.lng, place.lat], zoom: 15});
            marker.togglePopup();
        });

        resultsDiv.appendChild(placeElement);
    });

    if (places.length === 0) {
        resultsDiv.innerHTML = '<p>No places found. Try a different location or category.</p>';
    }

    // Fit map to show all markers
    const bounds = new mapboxgl.LngLatBounds();
    map.markers.forEach(marker => bounds.extend(marker.getLngLat()));
    map.fitBounds(bounds, {padding: 50});
}

function handleError(error) {
    console.error('Error:', error);
    alert(error.message || 'An unexpected error occurred. Please try again.');
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.className = 'loading';
    loadingDiv.textContent = 'Loading...';
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

window.onload = init;

window.onload = init;
