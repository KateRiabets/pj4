from database import Database
from bson import ObjectId
import jwt
import datetime
import asyncio
import websockets
import logging
import json
from datetime import datetime, timedelta
logging.basicConfig(level=logging.INFO)

db = Database()

countries, cities_by_country = db.preload_data()

SECRET_KEY = "my_secret_key"

def generate_jwt(username, is_admin):
    payload = {
        "username": username,
        "is_admin": is_admin,
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_jwt(token):
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return {"status": "SUCCESS", "data": decoded}
    except jwt.ExpiredSignatureError:
        return {"status": "ERROR", "message": "Token expired."}
    except jwt.InvalidTokenError:
        return {"status": "ERROR", "message": "Invalid token."}

async def handle_websocket(websocket):
    try:
        async for message in websocket:
            logging.info(f"Received message: {message}")
            try:
                data = json.loads(message)
            except json.JSONDecodeError as e:
                logging.error(f"JSON decode error: {e}")
                continue

            command = data.get("command")

            if command == "LOGIN":
                username, password = data["username"], data["password"]
                result, nickname, is_admin = db.authenticate_user(username, password)
                if result == "SUCCESS":
                    token = generate_jwt(username, is_admin)
                    await websocket.send(
                        json.dumps({"status": result, "nickname": nickname, "is_admin": is_admin, "token": token}))
                else:
                    await websocket.send(json.dumps({"status": result}))

            elif command == "REGISTER":
                username, password, nickname = data["username"], data["password"], data["nickname"]
                result = db.register(username, password, nickname)
                await websocket.send(json.dumps({"status": result}))

            elif command == "GET_TOUR_DETAILS":
                print("get details")
                tour_id = data.get("tourId")
                if tour_id:
                    tour_data = db.get_tour_by_id(tour_id)
                    if tour_data:
                        await websocket.send(
                            json.dumps({"status": "GET_TOUR_DETAILS", "data": tour_data}, default=json_serialize))
                    else:
                        await websocket.send(json.dumps({"status": "ERROR", "message": "Tour not found."}))
                else:
                    await websocket.send(json.dumps({"status": "ERROR", "message": "Tour ID is missing."}))



            elif command == "GET_USER_TOURS":
                print("Fetching user tours")
                nickname = data.get("nickname")
                if nickname:
                    tours_data = db.get_tours_by_user_nickname(nickname)  # Вызов функции из класса Database
                    if tours_data:
                        await websocket.send(
                            json.dumps({"status": "GET_USER_TOURS", "data": tours_data}, default=json_serialize))
                    else:
                        await websocket.send(
                            json.dumps({"status": "ERROR", "message": "No tours found for this user."}))
                else:
                    await websocket.send(json.dumps({"status": "ERROR", "message": "Nickname is missing."}))




            elif command == "GET_TOUR":

                tours = db.find_documents("tour", {})

                try:

                    tours_data = json.dumps({"status": "GET_TOUR", "data": tours}, default=json_serialize)

                    print("Sending tours data:", tours_data)

                    await websocket.send(tours_data)

                except TypeError as e:

                    logging.error(f"Serialization error: {e}")

                    await websocket.send(json.dumps({"status": "ERROR", "message": "Data serialization failed."}))


            elif command == "EDIT_TOUR":
                tour_id = data["tourId"]
                tour_data = {key: data[key] for key in data if key != "command" and key != "tourId"}
                db.update_tour( tour_id, tour_data)
                await websocket.send(json.dumps({"status": "SUCCESS", "message": "Tour updated successfully."}))

            elif command == "DELETE_TOUR":
                tour_id = data["tourId"]
                db. delete_tour(tour_id)
                await websocket.send(json.dumps({"status": "SUCCESS", "message": "Tour deleted successfully."}))

            elif command == "NEW_TOUR":
                try:
                    tour_data = json.loads(message)
                    tour_data = tour_data['data']
                    tour_id = db.add_new_tour(tour_data)
                    if tour_id:
                        print(f"Тур додано{tour_id}.")
                        await send_success_response(websocket, "Тур успішно додано.")  # исправлено
                    else:
                        print("Помилка при додаванні тура.")
                        await send_error_response(websocket, "Помилка при додаванні тура в базу даних.")  # исправлено
                except json.JSONDecodeError as e:
                    print(f"Помилка JSON: {e}")
                    await send_error_response(websocket, "Неправильний формат данних.")







            elif command == "SEARCH_TOURS":
                sort_options = {}
                print("SEARCH_TOURS")
                query = {}
                data = data.get("searchParams", {})
                if "query" in data and data["query"]:
                    query["$text"] = {"$search": data["query"]}
                if "priceRange" in data:
                    price_range = {}
                    if "from" in data["priceRange"] and data["priceRange"]["from"]:
                        price_range["$gte"] = int(data["priceRange"]["from"])
                    if "to" in data["priceRange"] and data["priceRange"]["to"]:
                        price_range["$lte"] = int(data["priceRange"]["to"])
                    if price_range:
                        query["price"] = price_range

                if "dateRange" in data:
                    date_range_query = {}
                    if "start" in data["dateRange"] and data["dateRange"]["start"]:
                        start_date = datetime.fromisoformat(data["dateRange"]["start"]).strftime('%Y-%m-%d')
                        date_range_query["startDate"] = {"$gte": start_date}
                    if "end" in data["dateRange"] and data["dateRange"]["end"]:
                        end_date = datetime.fromisoformat(data["dateRange"]["end"]).strftime('%Y-%m-%d')
                        date_range_query["endDate"] = {"$lte": end_date}
                    if date_range_query:
                        query["$and"] = [{"startDate": date_range_query["startDate"]},
                                         {"endDate": date_range_query["endDate"]}]
                if "location" in data and "country" in data["location"]:
                    query["route.country"] = data["location"]["country"]
                if "location" in data and "city" in data["location"]:
                    query["route.city"] = data["location"]["city"]
                if "sort" in data and isinstance(data["sort"], dict):
                    sort_options = data["sort"]
                print("Query constructed:", query)
                tours = db.find_documents("tour", query, sort_options=sort_options)

                print("Tours found:", tours)

                tours_data = json.dumps({"status": "GET_TOUR", "data": tours}, default=json_serialize)

                await websocket.send(tours_data)



            elif command == "SUBMIT_RATING":
                user_id = data.get("username")
                tour_id = data.get("tourId")
                rating = data.get("rating")

                if user_id and tour_id and rating is not None:
                    try:
                        rating = int(rating)
                        if rating < 1 or rating > 5:
                            raise ValueError("Rating must be between 1 and 5.")
                        feedback_id = db.insert_feedback(user_id, tour_id, rating)
                        await websocket.send(
                            json.dumps({"status": "SUCCESS", "message": "Rating submitted successfully."}))
                    except ValueError as e:
                        await websocket.send(json.dumps({"status": "ERROR", "message": str(e)}))
                else:
                    await websocket.send(json.dumps({"status": "ERROR", "message": "Missing required data."}))


            elif command == "BOOK_TOUR":

                username = data.get("username")
                tour_id = data.get("tourId")

                if username and tour_id:
                    try:
                        updated_count = db.add_tour_to_user(username, tour_id)

                        if updated_count:
                                await websocket.send(
                                json.dumps({"status": "SUCCESS", "message": "Tour booked successfully."}))

                        else:
                             await websocket.send(
                                json.dumps({"status": "INFO", "message": "You have already booked this tour."}))
                    except Exception as e:
                        logging.error(f"Error booking tour: {e}")
                        await websocket.send(
                            json.dumps({"status": "ERROR", "message": "Failed to book the tour due to an error."}))

                else:
                    logging.error("Missing username or tourId")
                    await websocket.send(json.dumps({"status": "ERROR", "message": "Missing required data."}))



            elif command == "STATISTIC":
                tours_data = db.get_tours_with_average_ratings()
                await websocket.send(json.dumps({"status": "STATISTIC", "data": tours_data}))





            elif command == "AUTHENTICATE":
                token = data.get("token")
                if token:
                    token_validation = decode_jwt(token)

                    if token_validation["status"] == "SUCCESS":
                        await websocket.send(json.dumps({"status": "RECONNECT", "data": token_validation["data"]}))
                        print("RECONNECT")

                        countries_and_cities = []
                        for country, cities in cities_by_country.items():
                            country_data = {"country": country, "cities": [city['City'] for city in cities]}
                            countries_and_cities.append(country_data)
                        await websocket.send(
                            json.dumps({"status": "COUNTRIES_AND_CITIES", "data": countries_and_cities}))
                        print("SiTY&COUNTRY")



                    else:
                        await websocket.send(json.dumps({"status": "ERROR", "message": token_validation["message"]}))
                else:
                    await websocket.send(json.dumps({"status": "ERROR", "message": "Token is missing."}))

            else:
                logging.info(f"Unknown command: {command}")
                await websocket.send(json.dumps({"status": "ERROR"}))
    except websockets.exceptions.ConnectionClosed:
        logging.info("Connection closed")



async def send_success_response(websocket, message):
    response = {"status": "SUCCESS", "message": message}
    await websocket.send(json.dumps(response))  # websocket для відправки

async def send_error_response(websocket, error_message):
    response = {"status": "ERROR", "message": error_message}
    await websocket.send(json.dumps(response))  # websocket для відправки

async def main():
    server = await websockets.serve(handle_websocket, 'localhost', 1245)
    logging.info("WebSocket сервер запущено на ws://localhost:1241")
    await server.wait_closed()

def json_serialize(obj):

    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


if __name__ == "__main__":
    asyncio.run(main())