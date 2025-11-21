from datetime import datetime  # Add datetime import
from typing import Any, Optional
from bson import ObjectId
from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    GetCoreSchemaHandler,
    GetJsonSchemaHandler
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from pydantic.alias_generators import to_camel
from .base import PyObjectId, _MongoModel

# -----------------------------------------------------------------------------
# Mongo helpers
# -----------------------------------------------------------------------------
# class PyObjectId(ObjectId):
#     """ObjectId that round‑trips as a string in Pydantic v2."""

#     @classmethod
#     def validate(cls, v: Any) -> ObjectId:
#         """Validate that the input is a valid ObjectId or can be converted to one."""
#         if isinstance(v, ObjectId):
#             return v
#         if isinstance(v, str):
#             if ObjectId.is_valid(v):
#                 return ObjectId(v)
#             else:
#                 raise ValueError(f"'{v}' is not a valid ObjectId string")
#         # Allow direct Pydantic validation to handle other type errors for clarity
#         raise TypeError("ObjectId must be a string or ObjectId instance")

#     @classmethod
#     def __get_pydantic_core_schema__(
#         cls, source_type: Any, handler: GetCoreSchemaHandler
#     ) -> core_schema.CoreSchema:
#         """Return a Pydantic CoreSchema that defines how to validate and serialize this type."""
#         return core_schema.json_or_python_schema(
#             python_schema=core_schema.no_info_plain_validator_function(cls.validate),
#             json_schema=core_schema.str_schema(), # In JSON, we expect a string
#             serialization=core_schema.plain_serializer_function_ser_schema(str)
#         )

#     @classmethod
#     def __get_pydantic_json_schema__(
#         cls, core_schema_obj: core_schema.CoreSchema, handler: GetJsonSchemaHandler
#     ) -> JsonSchemaValue:
#         """Return a JSON schema representation for this type."""
#         json_schema = handler(core_schema.str_schema()) # Base it on a string schema
#         json_schema = handler.resolve_ref_schema(json_schema)
#         json_schema.update(type='string', format='objectid')
#         return json_schema


# class _MongoModel(BaseModel):
#     """Base model: adds `_id`, JSON encoders, and common config."""

#     id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

#     model_config = ConfigDict(
#         populate_by_name=True,
#         arbitrary_types_allowed=True,
#         json_encoders={ObjectId: str},
#         str_strip_whitespace=True,
#         alias_generator=to_camel,
#     )


class UserActivity(_MongoModel):
    """Schema for storing general user activities."""
    user_id: ObjectId = Field(..., alias="userId")
    activity_type: "LoggedActionTypes" = Field(..., alias="activityType")  # Use string type hint to avoid circular import
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    details: Optional[dict[str, Any]] = None  # Specific details about the activity

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
        alias_generator=to_camel,
    )
