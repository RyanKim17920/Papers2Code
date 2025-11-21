import datetime
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel

camel_case_config = ConfigDict(
    populate_by_name=True,
    alias_generator=to_camel,
)

camel_case_config_with_datetime = ConfigDict(
    populate_by_name=True,
    alias_generator=to_camel,
    json_encoders={datetime: lambda dt: dt.isoformat()},
)

set_implementability_config = ConfigDict(
    populate_by_name=True,
    alias_generator=to_camel,
    validate_by_name=True, 
)