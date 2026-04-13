import { Component, ReactElement, ReactNode } from 'react';
import type { UploadProps } from 'antd';
import { Button, Upload as AntdUpload, UploadFile } from 'antd';
import SparkMD5 from 'spark-md5';
import { Accept, UploadType } from 'grt-components';

interface genUrlResult {
    success: boolean;
    data: string | undefined | null;
}

interface OssConfig {
    token: string;
    tenantId: string;
    ossSignUrl: string;
    bucketName: string;
}

export interface Props {
    uploadItem?: ReactNode;
    uploadType?: UploadType;
    dirname?: string;
    className?: string;
    directory?: boolean;
    bucketName?: string;
    ossSignUrl?: string;
    onChange?: (file: UploadFile, type?: any) => void | boolean | undefined;
    beforeUpload?: (file: UploadFile, name: string, md5: string, type?: any) => Promise<boolean | undefined | void>;
    processFunc?: (processNumber: number, file: UploadFile, xhr: XMLHttpRequest, ossResult: any) => void;
    completeFunc?: (ossResult: any, file: UploadFile) => void;
    errorFunc?: (error: any, file: UploadFile, ossResult: any) => void;
    itemRender?: (originNode: ReactElement, file: UploadFile, fileList: object[], actions: any) => ReactNode;
    maxSize?: number;
    multiple?: boolean;
}

type FileExtType = {
    [name: symbol]: string[];
};
type FileExtMap = {
    [name: number]: symbol;
};

export interface State {}

const FILE_EXT_SYMBOL_IMAGE = Symbol('IMAGE'),
    FILE_EXT_SYMBOL_VIDEO = Symbol('VIDEO'),
    FILE_EXT_SYMBOL_DOCS = Symbol('DOCS'),
    FILE_EXT_SYMBOL_AUDIO = Symbol('AUDIO'),
    FILE_EXT_SYMBOL_UNSET = Symbol('UNSET'),
    FILE_EXT_SYMBOL_USER_AVATAR = Symbol('USER_AVATAR');

export const FILE_EXT_MAP: FileExtMap = {
    [UploadType.IMAGE]: FILE_EXT_SYMBOL_IMAGE,
    [UploadType.DOCS]: FILE_EXT_SYMBOL_DOCS,
    [UploadType.VIDEO]: FILE_EXT_SYMBOL_VIDEO,
    [UploadType.AUDIO]: FILE_EXT_SYMBOL_AUDIO,
    [UploadType.USER_AVATAR]: FILE_EXT_SYMBOL_USER_AVATAR,
    [UploadType.UNSET]: FILE_EXT_SYMBOL_UNSET
};

export const FILE_EXT: FileExtType = {
    [FILE_EXT_SYMBOL_IMAGE]: ['jpg', 'gif', 'png', 'bmp', 'jpeg'],
    [FILE_EXT_SYMBOL_VIDEO]: ['mp4', 'mov', 'm4v', 'flv', 'wmv', 'avi', 'rmvb', '3gp', 'ts', 'mxv'],
    [FILE_EXT_SYMBOL_DOCS]: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'csv', 'txt', 'json'],
    [FILE_EXT_SYMBOL_AUDIO]: ['mp3', 'mpeg', 'wma', 'm4r', 'm4a', 'acc', 'ape', 'flac', 'amr', 'wav', 'wv', 'ogg'],
    [FILE_EXT_SYMBOL_USER_AVATAR]: ['jpg', 'png', 'jpeg'],
    [FILE_EXT_SYMBOL_UNSET]: [
        'jpg', 'gif', 'png', 'bmp', 'jpeg',
        'mp4', 'mov', 'm4v', 'flv', 'wmv', 'avi', 'rmvb', '3gp', 'ts', 'mxv',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'csv', 'txt', 'json',
        'mp3', 'mpeg', 'wma', 'm4r', 'm4a', 'acc', 'ape', 'flac', 'amr', 'wav', 'wv', 'ogg'
    ]
};

const DEFAULT_OSS_SIGN_URL = 'https://test-guoren-api.grtcloud.net/jeecg-boot/open/aliyun/oss/v1/temp/url';
const DEFAULT_BUCKET_NAME = 'guoren-files-test';
const DEFAULT_CONTENT_TYPE = 'text/plain';

// 从 config.yaml 解析配置
function parseYamlConfig(rawText: string): Record<string, string> {
    const lines = rawText.split(/\r?\n/);
    const config: Record<string, string> = {};
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
            continue;
        }
        const separatorIndex = trimmedLine.indexOf(':');
        if (separatorIndex === -1) continue;
        
        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key) config[key] = value;
    }
    return config;
}

// 缓存配置
let cachedOssConfig: OssConfig | null = null;

// 从 config.yaml 加载 OSS 配置
async function loadOssConfig(): Promise<OssConfig> {
    if (cachedOssConfig) return cachedOssConfig;
    
    try {
        const response = await fetch('/config.yaml');
        const rawText = await response.text();
        const config = parseYamlConfig(rawText);
        
        cachedOssConfig = {
            token: config.token || '',
            tenantId: config.user_id || '1000',
            ossSignUrl: DEFAULT_OSS_SIGN_URL,
            bucketName: DEFAULT_BUCKET_NAME
        };
        console.log('从 config.yaml 加载 token 成功');
        return cachedOssConfig;
    } catch (error) {
        console.error('加载 config.yaml 失败:', error);
        return {
            token: '',
            tenantId: '1000',
            ossSignUrl: DEFAULT_OSS_SIGN_URL,
            bucketName: DEFAULT_BUCKET_NAME
        };
    }
}

class OssUpload extends Component<Props, State> {
    state: State = {};

    async getUploadSignUrl(api: string, bucket_name: string, object_key: string) {
        try {
            // 从 config.yaml 读取 token
            const ossConfig = await loadOssConfig();
            const token = ossConfig.token || localStorage.getItem('SUPERSONIC_TOKEN') || '';
            const id = ossConfig.tenantId || localStorage.getItem('SUPERSONIC_TENANT_ID') || '';
            
            const result = await fetch(api, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token,
                    'x-tenant-id': id
                },
                body: JSON.stringify({
                    bucketName: bucket_name,
                    objectKey: object_key,
                    method: 'PUT',
                    headers: { 'Content-Type': DEFAULT_CONTENT_TYPE }
                })
            });
            return result.json();
        } catch (error) {
            console.error('获取阿里云OSS签名URL失败:', error);
            return { success: false, result: null };
        }
    }

    xhrUploadFile(uploadUrl: string, file: UploadFile, headers: Record<string, string> = {}, ossResult: any = {}) {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        
        for (let key in headers) {
            const value = headers[key];
            if (key) {
                xhr.setRequestHeader(key, value);
            }
        }
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                console.debug('upload progress:', event.loaded / event.total);
                if (this.props.processFunc) {
                    this.props.processFunc(event.loaded / event.total, file, xhr, ossResult);
                }
            }
        };
        
        xhr.onerror = (err) => {
            if (this.props.errorFunc) {
                console.error('上传失败:', err);
                this.props.errorFunc(err, file, ossResult);
            }
        };
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                if (this.props.completeFunc) {
                    console.debug('upload complete');
                    const url: string = xhr.responseURL;
                    ossResult.fileUrl = url.substring(0, url.indexOf('?'));
                    this.props.completeFunc(ossResult, file);
                }
            } else {
                if (this.props.errorFunc) {
                    this.props.errorFunc({ status: xhr.status, message: xhr.statusText }, file, ossResult);
                }
            }
        };
        
        xhr.send(file as any);
        return xhr;
    }

    get uploadItem(): ReactNode {
        return this.props.uploadItem ? this.props.uploadItem : <Button>上传</Button>;
    }

    getAccept(type: UploadType): Accept {
        let accept: Accept = Accept.UNSET;
        switch (type) {
            case UploadType.AUDIO: accept = Accept.AUDIO; break;
            case UploadType.DOCS: accept = Accept.DOCS; break;
            case UploadType.IMAGE: accept = Accept.IMAGE; break;
            case UploadType.VIDEO: accept = Accept.VIDEO; break;
            case UploadType.UNSET: accept = Accept.UNSET; break;
            case UploadType.USER_AVATAR: accept = Accept.USER_AVATAR; break;
        }
        return accept;
    }

    getFileMD5(file: any): Promise<string> {
        return new Promise((resolve) => {
            if (file && file.size < 2 * 1024 * 1024) {
                const fileReader = new FileReader();
                fileReader.readAsBinaryString(file);
                fileReader.onload = (e: any) => {
                    resolve(SparkMD5.hashBinary(e.target.result));
                };
                return;
            }
            const sliceLength = 10,
                chunkSize = Math.ceil(file.size / sliceLength),
                fileReader = new FileReader(),
                md5 = new SparkMD5();
            let index = 0,
                loadFile: () => void;
            loadFile = () => {
                const slice = file.slice(index, index + chunkSize);
                fileReader.readAsBinaryString(slice);
            };
            loadFile();
            fileReader.onload = (e: any) => {
                md5.appendBinary(e.target.result);
                if (index < file.size) {
                    index += chunkSize;
                    loadFile();
                } else {
                    resolve(md5.end());
                }
            };
        });
    }

    getFileTypeByExt(ext: string): UploadType {
        ext = ext.toLowerCase();
        if (FILE_EXT[FILE_EXT_SYMBOL_VIDEO].includes(ext)) return UploadType.VIDEO;
        else if (FILE_EXT[FILE_EXT_SYMBOL_AUDIO].includes(ext)) return UploadType.AUDIO;
        else if (FILE_EXT[FILE_EXT_SYMBOL_IMAGE].includes(ext)) return UploadType.IMAGE;
        else if (FILE_EXT[FILE_EXT_SYMBOL_DOCS].includes(ext)) return UploadType.DOCS;
        return UploadType.UNSET;
    }

    getFileExtAndName(fileName: string) {
        const index = fileName.lastIndexOf('.');
        const ext = fileName.substring(index + 1);
        const name = fileName.substring(0, index);
        return { fileExt: ext, fileName: name };
    }

    uploadOption: UploadProps = {
        accept: this.getAccept(this.props.uploadType || UploadType.UNSET),
        itemRender: this.props.itemRender || (() => null),
        beforeUpload: () => false,
        multiple: this.props.multiple || false,
        directory: this.props.directory || false,
        onChange: async ({ file }) => {
            if (file.status) return false;
            
            const { name } = file;
            let { fileExt, fileName } = this.getFileExtAndName(name);
            
            const relativePath = (file as any).webkitRelativePath || '';
            const pathParts = relativePath.split('/').filter((p: string) => p);
            const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
            
            const uploadType = this.props.uploadType || UploadType.UNSET;
            const fileType: UploadType = this.getFileTypeByExt(fileExt);
            
            if (uploadType !== undefined && uploadType !== null) {
                const fileExtMap = FILE_EXT_MAP[uploadType];
                if (!fileExtMap) {
                    if (this.props.errorFunc) {
                        this.props.errorFunc(
                            { message: '文件格式不支持', size: file.size, maxSize: this.props.maxSize },
                            file, {}
                        );
                    }
                    return false;
                }
                const extList = FILE_EXT[fileExtMap];
                if (fileExt && !extList.includes(fileExt.toLowerCase())) {
                    if (this.props.errorFunc) {
                        this.props.errorFunc(
                            { message: '文件格式不支持', size: file.size, maxSize: this.props.maxSize },
                            file, {}
                        );
                    }
                    return false;
                }
            }
            
            if (this.props.onChange) {
                const changeFlag = this.props.onChange(file, fileType);
                if (!changeFlag && changeFlag !== undefined) return false;
            }
            
            if (this.props.maxSize && file.size && file.size > this.props.maxSize) {
                if (this.props.errorFunc) {
                    this.props.errorFunc(
                        { message: '文件大小超出限制', size: file.size, maxSize: this.props.maxSize },
                        file, {}
                    );
                }
                return false;
            }
            
            const md5 = await this.getFileMD5(file);
            const ossConfig = await loadOssConfig();
            const id = ossConfig.tenantId || localStorage.getItem('SUPERSONIC_TENANT_ID') || '';
            const rename = md5 + '.' + fileExt;
            const folderPrefix = folderPath ? folderPath + '/' : '';
            
            const fileKey = this.props.dirname
                ? this.props.dirname + '/' + folderPrefix + rename
                : `input/${id}/${rename}`;
            
            const bucket = this.props.bucketName || ossConfig.bucketName || DEFAULT_BUCKET_NAME;
            const signUrl = this.props.ossSignUrl || ossConfig.ossSignUrl || DEFAULT_OSS_SIGN_URL;
            
            console.log('阿里云OSS上传 - bucket:', bucket, 'objectKey:', fileKey);
            
            const signResult = await this.getUploadSignUrl(signUrl, bucket, fileKey);
            console.log('签名结果:', signResult);
            
            if (!signResult.success) {
                if (this.props.errorFunc) {
                    this.props.errorFunc({ message: '获取签名URL失败', detail: signResult }, file, {});
                }
                return false;
            }
            
            let signedUrl: string;
            if (signResult.result) {
                signedUrl = signResult.result;
            } else {
                if (this.props.errorFunc) {
                    this.props.errorFunc({ message: '签名URL格式错误' }, file, {});
                }
                return false;
            }
            
            if (this.props.beforeUpload) {
                const beforeFlag = await this.props.beforeUpload(file, fileKey, md5, fileType);
                if (!beforeFlag && beforeFlag !== undefined) return false;
            }
            
            this.xhrUploadFile(signedUrl, file, { 'Content-Type': DEFAULT_CONTENT_TYPE }, {
                bucketName: bucket,
                objectKey: fileKey,
                md5,
                ext: fileExt,
                fileName,
                fileType,
                folderPath: folderPath
            });
        }
    };

    render(): ReactNode {
        return <AntdUpload {...this.uploadOption}>{this.uploadItem}</AntdUpload>;
    }
}

export default OssUpload;

export const getOssDownloadSignUrl = async (
    bucket_name: string, 
    object_key: string,
    ossSignUrl?: string
): Promise<genUrlResult> => {
    try {
        const ossConfig = await loadOssConfig();
        const token = ossConfig.token || localStorage.getItem('SUPERSONIC_TOKEN') || '';
        const id = ossConfig.tenantId || localStorage.getItem('SUPERSONIC_TENANT_ID') || '';
        const signUrl = ossSignUrl || ossConfig.ossSignUrl || DEFAULT_OSS_SIGN_URL;
        
        const result = await fetch(signUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token,
                'x-tenant-id': id
            },
            body: JSON.stringify({
                bucketName: bucket_name,
                objectKey: object_key,
                method: 'GET'
            })
        });
        
        return result.json().then((res) => {
            const { success, result } = res;
            if (!success) return { success: false, data: null };
            return { success: true, data: result };
        });
    } catch (error) {
        console.error('获取下载签名URL失败:', error);
        return { success: false, data: JSON.stringify(error) };
    }
};