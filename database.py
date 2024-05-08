from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
class Database:
    def __init__(self):
        uri = "mongodb+srv://777curemoonlight:51030060r@turtleabroad.zcihkmu.mongodb.net/?retryWrites=true&w=majority&appName=TurtleAbroad"
        self.client = MongoClient(uri)
        self.db = self.client["TurtleAbroad"]

    def get_collection(self, collection_name):
       return self.db[collection_name]

    def insert_document(self, collection_name, document):
        collection = self.get_collection(collection_name)
        return collection.insert_one(document).inserted_id

    def find_documents(self, collection_name, query, sort_options=None):
        collection = self.get_collection(collection_name)
        pipeline = []
        if "$text" in query:
            pipeline.append({"$match": {"$text": {"$search": query["$text"]["$search"]}}})
            del query["$text"]


        pipeline.append({
            "$addFields": {
                "numericPrice": {"$toInt": "$price"}
            }
        })
        pipeline.append({
            "$lookup": {
                "from": "feedback",
                "localField": "_id",
                "foreignField": "tour_id",
                "as": "feedbacks"
            }
        })
        pipeline.append({
            "$addFields": {
                "average_rating": {"$avg": "$feedbacks.rating"}
            }
        })
        pipeline.append({
            "$addFields": {
                "average_rating": {"$ifNull": ["$average_rating", "Not Rated"]}
            }
        })

        match_query = {}
        for key, value in query.items():
            if key == 'price':
                numeric_price_query = {}
                if '$gte' in value:
                    numeric_price_query['$gte'] = int(value['$gte'])
                if '$lte' in value:
                    numeric_price_query['$lte'] = int(value['$lte'])
                match_query['numericPrice'] = numeric_price_query
            else:
                match_query[key] = value

        pipeline.append({"$match": match_query})

        if sort_options:
            sort_criteria = {}
            for field, direction in sort_options.items():
                if field in ["price"]:
                    sort_criteria["numericPrice"] = 1 if direction == "asc" else -1
                elif field in ["startDate", "endDate"]:
                    sort_criteria[field] = 1 if direction == "asc" else -1
                elif field == "rating":
                    sort_criteria["average_rating"] = 1 if direction == "asc" else -1

            if sort_criteria:
                pipeline.append({"$sort": sort_criteria})

        result = list(collection.aggregate(pipeline))
        print(f"Query: {match_query}, Found: {len(result)} documents")
        return result

    def register(self, login, password, nickname):
        collection = self.get_collection("user")
        if collection.find_one({"login": login}):
            return "ERROR: Пользователь с таким логином уже существует"
        document = {
            "login": login,
            "password": password,
            "nickname": nickname,
            "is_admin": False,
            "phone_number": "0",
            "tours": []
        }
        self.insert_document("user", document)
        return "SUCCESS"

    def authenticate_user(self, login, password):
        collection = self.get_collection("user")
        user = collection.find_one({"login": login})
        if user and user["password"] == password:
            return "SUCCESS", user["nickname"], user.get("is_admin", False)
        else:
            return "ERROR: Неверный логин или пароль", None, None

    def get_countries(self):
        return list(self.get_collection("country").distinct("Country"))

    def get_cities_by_country(self, country_name):
        return list(self.get_collection("country").find({"Country": country_name}, {"City": 1, "_id": 0}))

    def preload_data(self):
        countries = self.get_countries()
        cities_by_country = {country: self.get_cities_by_country(country) for country in countries}
        return countries, cities_by_country


    def add_new_tour(self, tour_data):
        return self.insert_document("tour", tour_data)

    def get_tour_by_id(self, tour_id):
        collection = self.get_collection("tour")
        return collection.find_one({"_id": ObjectId(tour_id)})

    def update_tour(self, tour_id, tour_data):

        collection = self.get_collection("tour")
        result = collection.update_one({"_id": ObjectId(tour_id)}, {"$set": tour_data})
        return result.modified_count

    def delete_tour(self, tour_id):

        collection = self.get_collection("tour")
        result = collection.delete_one({"_id": ObjectId(tour_id)})
        return result.deleted_count


    def insert_feedback(self, user_id, tour_id, rating):
        collection = self.get_collection("feedback")
        feedback = {
            "user_id": user_id,
            "tour_id": ObjectId(tour_id),
            "rating": rating,
            "timestamp": datetime.utcnow()
        }
        return collection.insert_one(feedback).inserted_id

    # бронювання
    def add_tour_to_user(self, username, tour_id):

        user_collection = self.get_collection("user")
        result = user_collection.update_one(
            {"nickname": username},
            {"$addToSet": {"tours": tour_id}}  # щоб не дублювалося
        )
        return result.modified_count

    def get_user_by_username(self, username):
        """користувача по юзернейму"""
        user_collection = self.get_collection("user")
        return user_collection.find_one({"nickname": username})







    def get_tours_by_user_nickname(self, nickname):
        # повний список турів для  користувача по его nickname
        user_collection = self.get_collection("user")
        tour_collection = self.get_collection("tour")

        # знаходимо користувача  і отримуємо список його турів
        user = user_collection.find_one({"nickname": nickname}, {"tours": 1})
        if not user or 'tours' not in user:
            print(f"No tours found for user {nickname}")
            return []

        #  список ID турів із стрінгу в ObjectId
        tour_ids = [ObjectId(tour_id) for tour_id in user['tours']]

        # об'єднання даннх о турах
        pipeline = [
            {"$match": {"_id": {"$in": tour_ids}}},
            {"$lookup": {
                "from": "feedback",
                "localField": "_id",
                "foreignField": "tour_id",
                "as": "feedbacks"
            }},
            {"$addFields": {
                "average_rating": {"$avg": "$feedbacks.rating"}
            }},
            {"$addFields": {
                "average_rating": {"$ifNull": ["$average_rating", "Not Rated"]}
            }}
        ]
        tour_details = list(tour_collection.aggregate(pipeline))
        return tour_details

    def get_tours_with_average_ratings(self):
        # повертає список турів з ссередінм рейтингом та датами
        collection = self.get_collection("tour")
        pipeline = [
            {"$lookup": {
                "from": "feedback",
                "localField": "_id",
                "foreignField": "tour_id",
                "as": "feedbacks"
            }},
            {"$addFields": {
                "average_rating": {"$avg": "$feedbacks.rating"}
            }},
            {"$addFields": {
                "average_rating": {"$ifNull": ["$average_rating", "Not Rated"]}
            }},
            {"$project": {
                "_id": {"$toString": "$_id"},  #  ObjectId в стрінг
                "tourName": 1,
                "startDate": 1,
                "endDate": 1,
                "description": 1,
                "average_rating": 1
            }}
        ]
        result = list(collection.aggregate(pipeline))
        return result





