import Empty from 'antd/es/empty'
import Typography from 'antd/es/typography'
import { ConstructionOutlined } from '@/components/PlaceholderView/icons'

const { Title } = Typography

interface PlaceholderViewProps {
  title: string
}

export default function PlaceholderView({ title }: PlaceholderViewProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div style={{ padding: '16px 24px 0' }}>
        <Title level={5} style={{ margin: 0 }}>
          {title}
        </Title>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty
          image={<ConstructionOutlined />}
          description={`${title} 功能开发中`}
        />
      </div>
    </div>
  )
}
