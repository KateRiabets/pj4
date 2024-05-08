let ratingFixed = false;
let currentRating = 0;

//Підключення вебсокету
function connectWebSocket() {
    socket = new WebSocket('ws://localhost:1245');

    socket.onopen = function(e) {
        console.log("Соединение установлено");
         requestToursData();
         loadTourDetails();

        if (!window.location.href.includes("auth.html")) {
            const token = localStorage.getItem("token");

            if (token) {
                socket.send(JSON.stringify({command: "AUTHENTICATE", token: token}));
            } else {
                window.location.href = 'auth.html';
                return;
            }


            if (window.location.href.includes("admin.html")) {
                const isAdmin = localStorage.getItem("is_admin") === "true";
                if (!isAdmin) {
                    window.location.href = 'all_tour.html';
                    return;
                }
            }
        } else {
            showLoginForm();
        }
    };













socket.onmessage = function(event) {
     const isAdmin = localStorage.getItem("is_admin") === "true";
    console.log(`Данные получены: ${event.data}`);
    const data = JSON.parse(event.data);
    console.log("Received data:", data);
    console.log("Command:", data.command);
    console.log("Status:", data.status);

if (data.status === "SUCCESS") {
    console.log("Операція пройшла успішно!");

    // перевірка наявності токена
    if (data.token) {
        localStorage.setItem("token", data.token);
    }

    // перевірка іс адмін і збереження цього флагу
    if (data.hasOwnProperty('is_admin')) {
        localStorage.setItem("is_admin", data.is_admin);
        if (data.is_admin) {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'all_tour.html';
        }
    }
}

else if (data.status === "RECONNECT") {
    console.log(`is admin: ${localStorage.getItem("is_admin") === "true"}`);
    if (data.data.hasOwnProperty('username')) {
        localStorage.setItem("username", data.data.username); // збереження username
        updateUsernameOnUI(data.data.username); // оновлення UI с новим username

        // запит на отримання турів після реконнекту
        if (window.location.href.includes("choosen.html")) {
            console.log("Sending GET_USER_TOURS request for:", data.data.username);
            socket.send(JSON.stringify({ command: "GET_USER_TOURS", nickname: data.data.username }));
        }

        // Перевірка на statistic.html
        else if (window.location.href.includes("statistic.html")) {
            console.log("Sending STATISTIC request");
            socket.send(JSON.stringify({ command: "STATISTIC" }));
        }
    }
}


    else if (data.status === "STATISTIC") {
        console.log("Received STATISTIC data:", data.data);
        gatherStatistic(data.data); // Виклик функції для графіку
    }


    else if (data.status === "GET_USER_TOURS") {
        console.log("Updating user tours grid with data:", data.data);
        updateChoosenGrid(data.data);
    }




    else if (data.status === "COUNTRIES_AND_CITIES") {
        localStorage.setItem("countries_and_cities", JSON.stringify(data.data));
         fillCountriesDatalist();
        console.log("Країни і місто збережені у local storage");
    }

    else if (data.status === "GET_TOUR") {
        console.log("Updating tours grid with data:", data.data);
        updateToursGrid(data.data);
    }
    else if (data.status === "GET_TOUR_DETAILS" && isAdmin) {
        fillEditForm(data.data);
    }
    else if (data.status === "INFO") {
       alert(data.message);
       window.location.href = 'all_tour.html';
    }
    else if (data.status === "GET_TOUR_DETAILS") {
        updateTourDetails(data.data);
           }
    else {
        console.log("Помилка/Невідомий статус");
        debugger;
        if (!window.location.href.includes("auth.html")) {
            localStorage.removeItem("token");
            localStorage.removeItem("is_admin");
            window.location.href = 'auth.html';
        }
    }
};

function updateUsernameOnUI(username) {
    const userDisplayElement = document.querySelector('.side-menu p');
    if (userDisplayElement) {
        userDisplayElement.innerHTML = `Ви ввійшли як <br>${username}`;
    }
}

window.onload = function() {
    connectWebSocket();

    // спроба оновити юзернейм
    var username = localStorage.getItem('username');
    if (username) {
        updateUsernameOnUI(username);
    }
};


function gatherStatistic(data) {
    console.log("старт функції");
    console.log(data);

    // Рейтинги турів
    const tourNames = data.map(tour => tour.tourName || "No Name");
    const tourRatings = data.map(tour => {
        if (tour.average_rating === "Not Rated") {
            return 0;
        } else {
            return parseFloat(tour.average_rating);
        }
    });

    // Графік рейтенгу
    drawRatingChart(tourNames, tourRatings);

    // Графік по місяцям
    const { labels: monthLabels, dataPoints: monthDataPoints } = prepareDataForMonthChart(data);
    drawMonthChart(monthLabels, monthDataPoints);

    // Графік по трривалості туру
    const { labels: durationLabels, dataPoints: durationDataPoints } = prepareDataForDurationChart(data);
    drawDurationChart(durationLabels, durationDataPoints);
}

function drawRatingChart(tourNames, tourRatings) {
    var ctx = document.getElementById('tourChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tourNames,
            datasets: [{
                label: 'Средній рейтинг туру',
                data: tourRatings,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}


function prepareDataForMonthChart(data) {
    const monthCounts = data.reduce((acc, tour) => {
        const startDate = new Date(tour.startDate);
        const month = startDate.getMonth();
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});

    // перетврення для Chart.js об'єкту в массив
    const labels = Object.keys(monthCounts).map(month => new Date(0, month).toLocaleString('uk', { month: 'long' }));
    const dataPoints = Object.values(monthCounts);
    return { labels, dataPoints };
}

function drawMonthChart(labels, dataPoints) {
    var ctx = document.getElementById('monthChart').getContext('2d');
    var monthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Кількість турів по місяцях',
                data: dataPoints,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function prepareDataForDurationChart(data) {
    const durationCounts = data.reduce((acc, tour) => {
        const startDate = new Date(tour.startDate);
        const endDate = new Date(tour.endDate);
        const duration = (endDate - startDate) / (1000 * 3600 * 24);
        acc[duration] = (acc[duration] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(durationCounts).sort((a, b) => a - b);
    const dataPoints = labels.map(duration => durationCounts[duration]);
    return { labels, dataPoints };
}

function drawDurationChart(labels, dataPoints) {
    var ctx = document.getElementById('durationChart').getContext('2d');
    var durationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(label => `${label} днів`),
            datasets: [{
                label: 'Кількість турів за тривалістю',
                data: dataPoints,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
            ticks: {
                stepSize: 1
            }
                }
            }
        }
    });
}

function updateChoosenGrid(tours) {
    const grid = document.querySelector(".tour-container");
    grid.innerHTML = '<h2>Ваші тури</h2>'; // очистка турів, зберігаючи заголовок

    tours.forEach(tour => {
        const tourElement = document.createElement("div");

        let countriesList = tour.route.map(location => location.country).join(", ");

        tourElement.innerHTML = `
            <h2 class="tour-title">${tour.tourName}</h2>
            <div class="tour-content">
                <div class="tour-image-container">
                    <img src="img/${tour.image}.jpg" alt="${tour.tourName}" class="tour-image">
                </div>
                <div class="tour-description">

                    <p><b>Країни:</b> ${countriesList}</p>
                    <p><b>Дати:</b> ${tour.startDate} - ${tour.endDate}</p>
                </div>
                <div class="tour-info">
                    <div class="tour-pricing">
                        <p class="tour-price">${tour.price} грн.</p>
                        <p class="tour-price-euro">${(tour.price / 30).toFixed(2)} евро</p>
                        <p class="tour-duration">${Math.ceil((new Date(tour.endDate) - new Date(tour.startDate)) / (24 * 60 * 60 * 1000))} днів</p>
                    </div>

                </div>
            </div>
        `;
        grid.appendChild(tourElement);
    });
}



















    socket.onerror = function(error) {
        console.log(`Ошибка WebSocket: ${error.message}`);
    };
}

function showLoginForm() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
}

function showRegisterForm() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("registerForm").style.display = "block";
    document.getElementById("loginForm").style.display = "none";
}

async function login() {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    socket.send(JSON.stringify({command: "LOGIN", username, password}));
}

async function register() {
    event.preventDefault();
    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;
    const nickname = document.getElementById("registerNickname").value;
    socket.send(JSON.stringify({command: "REGISTER", username, password, nickname}));
}

window.onload = function() {
    connectWebSocket();

};


function collectTourData() {
    // збір даних з полів форми
    const tourName = document.getElementById("tourName").value;
    const image = document.getElementById("image").value;
    const numOfTravelers = document.getElementById("numOfTravelers").value;
    const price = document.getElementById("price").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const description = document.getElementById("description").value;
    const tags = document.getElementById("tags").value;

    // перевірка на пусті поля
    if (!tourName || !image || !numOfTravelers || !price || !startDate || !endDate || !description || !tags) {
        alert("Пожалуйста, заполните все поля формы.");
        return; //якщо є пусті поля припиняємо
    }

    const tourData = {
        tourName,
        image,
        numOfTravelers,
        price,
        startDate,
        endDate,
        description,
        tags,
        route: []
    };

    //збір даних про маршрут
    const routeGroups = document.querySelectorAll('.form-group2');
    console.log("Number of route groups:", routeGroups.length);

    routeGroups.forEach((group, index) => {
        console.log(`Processing group ${index + 1}`);
        const cities = Array.from(group.querySelectorAll('input[placeholder="Місто"]')).map(input => input.value);
        const countries = Array.from(group.querySelectorAll('input[placeholder="Країна"]')).map(input => input.value);

        // зміст масивів cities и countries
        console.log(`Cities in group ${index + 1}:`, cities);
        console.log(`Countries in group ${index + 1}:`, countries);

        cities.forEach((city, idx) => {
            if (!city || !countries[idx]) {
                alert("Будь ласка, заповніть всі поля.");
                return;
            }
            console.log(`City ${idx + 1} in group ${index + 1}: ${city}`);
            console.log(`Country ${idx + 1} in group ${index + 1}: ${countries[idx]}`);
            tourData.route.push({ city: city, country: countries[idx] });
        });
    });

    console.log("Collected tour data:", tourData);
    return tourData;
}


// відправка даних на сервер
function sendTourData() {
    const tourData = collectTourData();
    if (tourData){
    const tourDataJson = JSON.stringify({ command: "NEW_TOUR", data: tourData });
     console.log("Collected tour data:", tourData);
    socket.send(tourDataJson);
    }
}

// обробник "Додати"
document.querySelector('form').addEventListener('submit', function(event) {
    event.preventDefault();
    sendTourData();
     document.querySelector('form').reset();
});




function requestToursData() {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ command: "GET_TOUR" }));
    } else {
        console.log("WebSocket не підключено.");
    }
}


function updateToursGrid(tours) {
    const grid = document.getElementById("tours-grid");
    grid.innerHTML = ''; //очистка турів
    const baseUrl = window.location.href.includes("admin_edit1.html") ? "admin_edit2.html" : "tour1.html";
    console.log(`база: ${baseUrl}`);

    tours.forEach(tour => {
        const tourElement = document.createElement("div");
        tourElement.className = "tour-item";

        let countriesList = tour.route.map(location => location.country).join(", ");

        // зірочки для рейтинга
        const rating = Math.round(tour.average_rating || 0);
        const stars = [...Array(5)].map((_, index) => index < rating ? `<span class="star">&#9733;</span>` : `<span class="star">&#9734;</span>`).join('');

        tourElement.innerHTML = `
            <a href="${baseUrl}?tourId=${tour._id}">
                <img src="img/${tour.image}.jpg" alt="${tour.tourName}" class="tour-image">
                <div class="tour-info">
                    <div class="tour-description">
                        <h3 class="tour-title">${tour.tourName}</h3>
                        <p class="tour-cities">${countriesList}</p>
                        <p class="tour-dates">${tour.startDate} - ${tour.endDate}</p>
                    </div>
                    <div class="tour-meta">
                        <div class="tour-rating">${stars}</div>
                        <div class="tour-price">${tour.price} грн.</div>
                    </div>
                </div>
            </a>
        `;
        grid.appendChild(tourElement);
    });
}

function loadTourDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const tourId = urlParams.get('tourId');
     console.log("Підгрузка");
    if (tourId) {
        socket.send(JSON.stringify({ command: "GET_TOUR_DETAILS", tourId: tourId }));
    }
}



function updateTourDetails(tour) {
    const startDate = new Date(tour.startDate);
    const endDate = new Date(tour.endDate);
    const duration = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const countriesList = tour.route.map(location => location.country).join(", ");
    const citiesList = tour.route.map(location => location.city).join(", ");
    const exchangeRate = 42;
    const priceInEuro = (tour.price / exchangeRate).toFixed(2);

    document.querySelector(".tour-name").textContent = tour.tourName;
    document.querySelector(".price").textContent = tour.price + ' грн.';
    document.querySelector(".price-euro").textContent = priceInEuro + ' євро';
    document.querySelector(".duration").textContent = duration + ' днів';
    document.querySelector(".tour-description").innerHTML = `
        <p><b>Города:</b> ${citiesList}</p>
        <p><b>Страны:</b> ${countriesList}</p>
        <p><b>Даты:</b> ${tour.startDate} - ${tour.endDate}</p>
    `;
    document.querySelector(".full-description").textContent = tour.description;

    const imageContainer = document.querySelector(".tour-image");
    imageContainer.innerHTML = '';
    const img = new Image();
    img.src = `img/${tour.image}.jpg`;
    img.alt = tour.tourName;
    imageContainer.appendChild(img);

    initRating();  // ініціалізація рейтингу
    document.getElementById('submitRatingButton').addEventListener('click', function() {
     console.log("rating set",ratingFixed)
    if (ratingFixed) {
        const tourId = new URLSearchParams(window.location.search).get('tourId');
        const username = localStorage.getItem('username');
        const ratingData = {
            command: "SUBMIT_RATING",
            tourId: tourId,
            username: username,
            rating: currentRating
        };
        socket.send(JSON.stringify(ratingData));
        console.log("Рейтинг відправлено на сервер:", ratingData);
    } else {
        console.log("Рейтинг встановлено.");
    }
});

document.querySelector('.tour-booking button').addEventListener('click', function() {
    const tourId = new URLSearchParams(window.location.search).get('tourId');
    const username = localStorage.getItem('username');

    if (!username) {
        console.log("Користувач не в мережі.");
        return;
    }

    const bookingData = {
        command: "BOOK_TOUR",
        username: username,
        tourId: tourId
    };

    socket.send(JSON.stringify(bookingData));
    console.log("запит на бронювання відправлено:", bookingData);
});

}
function initRating() {

    const starsContainer = document.getElementById('rating-stars');
    if (!starsContainer) return;
    starsContainer.innerHTML = ''; // очистка попередніх зірочок
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.classList.add('star');
        star.textContent = '☆';
        star.addEventListener('mouseover', function() { if (!ratingFixed) highlightStars(i); });
        star.addEventListener('click', function() { setRating(i); });
        starsContainer.appendChild(star);
    }
}
function setRating(rating) {
    console.log("rating set")
    currentRating = rating;
    ratingFixed = true; // фіксуємо рейтинг
        highlightStars(rating); // оновлення
}
function highlightStars(rating) {
    const stars = document.querySelectorAll('#rating-stars .star');
    stars.forEach((star, index) => {
        star.textContent = index < rating ? '★' : '☆';
    });
}

function setupDatalist(inputElement, dataListId, options) {
    let datalist = document.getElementById(dataListId);
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = dataListId;
        document.body.appendChild(datalist);
    } else {
        datalist.innerHTML = '';  // очистка
    }

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        datalist.appendChild(optionElement);
    });

    inputElement.setAttribute('list', dataListId);
}

function updateCityDatalist(countryInput, cityInput) {
    const selectedCountry = countryInput.value;
    const countriesAndCities = JSON.parse(localStorage.getItem("countries_and_cities"));
    const cities = countriesAndCities.find(item => item.country === selectedCountry)?.cities || [];
    cityInput.value = '';  // очистка поля міста при зміні країни
console.log("Selected country:", selectedCountry);  // виведення країни
    console.log("Cities for selected country:", cities);  // міста для обраної країни
    setupDatalist(cityInput, cityInput.id + '-datalist', cities);
}

function fillEditForm(tour) {
    document.getElementById("tourName").value = tour.tourName;
    document.getElementById("image").value = tour.image;
    document.getElementById("numOfTravelers").value = tour.numOfTravelers;
    document.getElementById("price").value = tour.price;
    document.getElementById("startDate").value = tour.startDate;
    document.getElementById("endDate").value = tour.endDate;
    document.getElementById("description").value = tour.description;
    document.getElementById("tags").value = tour.tags;

    const routeContainer = document.querySelector('.form-group2');
    routeContainer.innerHTML = '';

    tour.route.forEach(location => {
        const routeGroup = createRouteGroup(location.city, location.country);
        routeContainer.appendChild(routeGroup);
    });

    addAddButton(routeContainer);  // кнопка для додавання нових груп
}


function createRouteGroup(city, country) {
    const routeGroup = document.createElement('div');
    routeGroup.className = 'route-edit-container';
    const timestamp = new Date().getTime();
    const countryId = 'country' + timestamp;
    const cityId = 'city' + timestamp;

    routeGroup.innerHTML = `
        <div class="input-group">
            <input type="text" class="input-city" id="${cityId}" placeholder="Місто" value="${city}">
            <input type="text" class="input-country" id="${countryId}" placeholder="Країна" value="${country}">
            <button type="button" onclick="removeRouteGroup(this)">
                <img src="img/minus.png" alt="Remove" style="width: 40%">
            </button>
        </div>
    `;

    const countryInput = routeGroup.querySelector('.input-country');
    const cityInput = routeGroup.querySelector('.input-city');
    setupDatalist(countryInput, countryId + '-datalist', JSON.parse(localStorage.getItem("countries_and_cities")).map(item => item.country));
    countryInput.addEventListener('change', () => updateCityDatalist(countryInput, cityInput));
    countryInput.addEventListener('input', () => {
        if (!countryInput.value) {
            cityInput.value = '';  //очистка міста, якщо немакраїни
        }
    });

    return routeGroup;
}

function addAddButton(routeContainer) {
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.innerHTML = '<img src="img/add_country.png" alt="Add another city">';
    addButton.onclick = () => {
        routeContainer.appendChild(createRouteGroup('', ''));
    };
    routeContainer.appendChild(addButton);
}



function removeRouteGroup(button) {
    button.parentElement.parentElement.remove();
}
document.getElementById('editTour').addEventListener('click', function() {
    const tourData = collectTourData();  //збір даних форми
    tourData.command = "EDIT_TOUR";  // команда
    tourData.tourId = new URLSearchParams(window.location.search).get('tourId');  //  ID тура з URL

    console.log("Sending tour data to server:", tourData);

    socket.send(JSON.stringify(tourData));  // відправка на сервер
    window.location.href = 'admin_edit1.html';  // Переадресація
});


document.getElementById('deleteTour').addEventListener('click', function() {
    const tourId = new URLSearchParams(window.location.search).get('tourId');
    if (confirm('Ви точно хочете видалити тур?')) {
        socket.send(JSON.stringify({ command: "DELETE_TOUR", tourId: tourId }));
        window.location.href = 'admin_edit1.html';
    }
});

function submitSearchForm() {
    const searchData = collectSearchData();
    socket.send(JSON.stringify(searchData));  // відправка даних
}




function collectSearchData() {
    const searchQuery = document.getElementById('search-query').value.trim();
    const priceFrom = document.getElementById('price-from').value;
    const priceTo = document.getElementById('price-to').value;
    const dateStart = document.getElementById('date-start').value;
    const dateEnd = document.getElementById('date-end').value;
    const country = document.getElementById('country').value;
    const city = document.getElementById('city').value;
    const sortValue = document.getElementById('sort-by').value;

    const sortOptions = {};
    if (sortValue.includes("price")) {
        sortOptions.price = sortValue.includes("asc") ? "asc" : "desc";
    }
    if (sortValue.includes("date")) {
        sortOptions.startDate = sortValue.includes("asc") ? "asc" : "desc";
    }
    if (sortValue.includes("rating")) {
        sortOptions.rating = sortValue.includes("asc") ? "asc" : "desc";
    }

    const searchData = {
        command: "SEARCH_TOURS",
        searchParams: {
            query: searchQuery,
            priceRange: {
                from: priceFrom || undefined,
                to: priceTo || undefined
            },
            dateRange: {
                start: dateStart || undefined,
                end: dateEnd || undefined
            },
            location: {
                country: country || undefined,
                city: city || undefined
            },
            sort: sortOptions
        }
    };

    return searchData;
}


function fillCountriesDatalist() {
   const locationData = JSON.parse(localStorage.getItem("countries_and_cities"));
    const countriesDatalist = document.getElementById("countries-datalist");
    const citiesDatalist = document.getElementById("city-datalist");

    countriesDatalist.innerHTML = '';
    citiesDatalist.innerHTML = '';

    let allCities = [];

    locationData.forEach(item => {
        // додаємо сторінки
        const countryOption = document.createElement('option');
        countryOption.value = item.country;
        countriesDatalist.appendChild(countryOption);

        // всі міста
        if (item.cities) {
            allCities = allCities.concat(item.cities);
        }
    });

    // видалення дублікатів зі списку міст
    allCities = Array.from(new Set(allCities));

    allCities.forEach(city => {
        const cityOption = document.createElement('option');
        cityOption.value = city;
        citiesDatalist.appendChild(cityOption);
    });
}




