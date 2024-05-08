from pymongo import MongoClient
import pprint

# Подключение к MongoDB
client = MongoClient('mongodb+srv://777curemoonlight:51030060r@turtleabroad.zcihkmu.mongodb.net/?retryWrites=true&w=majority&appName=TurtleAbroad')
db = client.TurtleAbroad

# Получение коллекции
collection = db.tour

collection.create_index([
    ('tourName', 'text'),
    ('tags', 'text'),
    ('route.country', 'text'),
    ('route.city', 'text')
])
indexes = collection.index_information()
print(indexes)