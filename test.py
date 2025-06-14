import requests 
import json

r = requests.post(
    'https://api.semanticscholar.org/graph/v1/paper/batch',
    params={'fields': 'referenceCount,citationCount,title'},
    json={"ids": ["649def34f8be52c8b66281af98ae884c09aef38b", "ARXIV:2106.15928"]}
)
print(json.dumps(r.json(), indent=2))