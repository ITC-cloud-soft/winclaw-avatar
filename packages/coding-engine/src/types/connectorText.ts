// Stub file for connectorText types
export type ConnectorTextBlock = {
  type: 'connector_text'
  text: string
}

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  text: string
}

export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock {
  return (block as ConnectorTextBlock)?.type === 'connector_text'
}
