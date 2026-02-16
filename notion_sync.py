
import sys
import json
import os
from openai import OpenAI

# Este script será chamado via shell para sincronizar os dados com o Notion
# Ele usa o manus-mcp-cli para interagir com o Notion

def sync_to_notion(lead_data):
    data_source_id = "ee5e781b-63ba-479a-9497-1ebf4f62e637"
    
    properties = {
        "Cliente": lead_data["cliente"],
        "Empresa": lead_data["empresa"],
        "Status": lead_data["status"],
        "Origem": lead_data["origem"],
        "Tipo": lead_data["tipo"],
        "Valor Total": float(lead_data["valor"]) if lead_data["valor"] else 0.0,
        "Lucro Real": float(lead_data["lucro"]) if lead_data["lucro"] else 0.0,
    }
    
    if lead_data["entrega"]:
        properties["date:Data Entrega:start"] = lead_data["entrega"]
        properties["date:Data Entrega:is_datetime"] = 0

    input_json = {
        "parent": {"data_source_id": data_source_id},
        "pages": [{"properties": properties}]
    }
    
    cmd = f"manus-mcp-cli tool call notion-create-pages --server notion --input '{json.dumps(input_json)}'"
    os.system(cmd)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        lead_json = sys.argv[1]
        lead_data = json.loads(lead_json)
        sync_to_notion(lead_data)
